import Foundation
@main struct ReminderWindowTests {
    static func main() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        for minutes in [15, 30, 60] {
            let window = ReminderWindow(minutes: minutes, now: now)!
            precondition(window.deadline.timeIntervalSince(now) == Double(minutes * 60))
            precondition(window.isValid(at: now))
            precondition(window.isValid(at: window.deadline.addingTimeInterval(-1)))
            precondition(!window.isValid(at: window.deadline))
            precondition(!window.isValid(at: now.addingTimeInterval(-1)))
        }
        for invalid in [Int.min, -1, 0, 1, 14, 16, 59, 61, Int.max] {
            precondition(ReminderWindow(minutes: invalid, now: now) == nil)
        }
        precondition(ReminderWindow(minutes: 15, now: Date(timeIntervalSince1970: .infinity)) == nil)
        print("Personal reminder window duration and expiry tests passed.")
    }
}
