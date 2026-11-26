import Foundation

// Explicit user-selected timer, not a provider score, fixture or predicted tip-off.
struct ReminderWindow: Codable, Hashable {
    let started: Date
    let deadline: Date
    static let allowedMinutes = [15, 30, 60]
    init?(minutes: Int, now: Date = Date()) {
        guard Self.allowedMinutes.contains(minutes), now.timeIntervalSinceReferenceDate.isFinite else { return nil }
        started = now
        deadline = now.addingTimeInterval(TimeInterval(minutes * 60))
    }
    func isValid(at now: Date) -> Bool {
        let seconds = deadline.timeIntervalSince(started)
        return Self.allowedMinutes.contains { seconds == TimeInterval($0 * 60) }
            && now >= started && now < deadline
    }
}
