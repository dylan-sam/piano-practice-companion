import Capacitor

/// The app's web view controller: registers the app's own Midi plugin with the bridge.
class MainViewController: CAPBridgeViewController {
    /// Register the app's plugins once the bridge exists.
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MidiPlugin())
    }
}
