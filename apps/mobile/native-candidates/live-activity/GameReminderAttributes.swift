import ActivityKit

@available(iOS 16.2, *)
struct GameReminderAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let window: ReminderWindow
    }
    // Constant identity only; no team names, scores, account IDs or tokens.
    let label: String
}
