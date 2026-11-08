import Capacitor
import CoreMIDI
import Foundation

/// MIDI keyboard input for Chord Sightreading (iOS web views have no Web MIDI).
/// Connects every CoreMIDI source (USB, Bluetooth, network), reads their MIDI 1.0
/// note messages and sends each to the web app as a "message" event; "devices"
/// reports the connected source names (studio/src/audio/nativeMidi.ts).
@objc(MidiPlugin)
public class MidiPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MidiPlugin"
    public let jsName = "Midi"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private var client = MIDIClientRef()
    private var port = MIDIPortRef()
    private var connected: [MIDIEndpointRef] = []

    /// Connect every MIDI source, and those plugged in later; resolve with their names.
    @objc func start(_ call: CAPPluginCall) {
        if client == 0 {
            let status = MIDIClientCreateWithBlock("EarTraining" as CFString, &client) { [weak self] notification in
                if notification.pointee.messageID == .msgSetupChanged {
                    DispatchQueue.main.async { self?.connectSources() }
                }
            }
            guard status == noErr else {
                call.reject("MIDI is unavailable (\(status))")
                return
            }
            let portStatus = MIDIInputPortCreateWithProtocol(client, "Input" as CFString, ._1_0, &port) { [weak self] list, _ in
                self?.read(list)
            }
            guard portStatus == noErr else {
                call.reject("MIDI input is unavailable (\(portStatus))")
                return
            }
        }
        connectSources()
        call.resolve(["devices": names()])
    }

    /// Disconnect every source.
    @objc func stop(_ call: CAPPluginCall) {
        for source in connected { MIDIPortDisconnectSource(port, source) }
        connected = []
        call.resolve()
    }

    /// Connect to the current sources and tell the web app their names.
    private func connectSources() {
        for source in connected { MIDIPortDisconnectSource(port, source) }
        connected = (0..<MIDIGetNumberOfSources()).map { MIDIGetSource($0) }.filter { $0 != 0 }
        for source in connected { MIDIPortConnectSource(port, source, nil) }
        notifyListeners("devices", data: ["devices": names()])
    }

    /// The display names of the connected sources.
    private func names() -> [String] {
        connected.map { source in
            var name: Unmanaged<CFString>?
            MIDIObjectGetStringProperty(source, kMIDIPropertyDisplayName, &name)
            return (name?.takeRetainedValue() as String?) ?? "MIDI keyboard"
        }
    }

    /// Forward the note-on and note-off messages of one event list (MIDI 1.0 channel voice packets).
    private func read(_ list: UnsafePointer<MIDIEventList>) {
        for packet in list.unsafeSequence() {
            let words = withUnsafeBytes(of: packet.pointee.words) { Array($0.bindMemory(to: UInt32.self)) }
            for word in words.prefix(Int(packet.pointee.wordCount)) where word >> 28 == 0x2 {
                let status = Int((word >> 16) & 0xff)
                let type = status & 0xf0
                guard type == 0x80 || type == 0x90 else { continue }
                let data = [status, Int((word >> 8) & 0x7f), Int(word & 0x7f)]
                DispatchQueue.main.async { [weak self] in self?.notifyListeners("message", data: ["data": data]) }
            }
        }
    }
}
