import ActivityKit
import Foundation

enum GameReminderError: Error {
    case invalidDuration, disabled, alreadyRunning, busy
}

// App-side native candidate. The host must call endAll on sign-out/opt-out,
// and reconcile on each foreground. No push token or background entitlement.
@available(iOS 16.2, *)
@MainActor final class GameReminderController {
    static let shared = GameReminderController()
    private var busy = false
    private init() {}
    func start(minutes: Int, now: Date = Date()) async throws {
        guard !busy else { throw GameReminderError.busy }
        busy = true
        defer { busy = false }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { throw GameReminderError.disabled }
        guard let window = ReminderWindow(minutes: minutes, now: now),
              window.isValid(at: Date()) else { throw GameReminderError.invalidDuration }
        await removeExpired(now: Date())
        guard Activity<GameReminderAttributes>.activities.isEmpty else { throw GameReminderError.alreadyRunning }
        let state = GameReminderAttributes.ContentState(window: window)
        _ = try Activity<GameReminderAttributes>.request(
            attributes: GameReminderAttributes(label: "HoopCheck"),
            content: ActivityContent(state: state, staleDate: window.deadline),
            pushType: nil
        )
    }
    func reconcile() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        if ActivityAuthorizationInfo().areActivitiesEnabled {
            await removeExpired(now: Date())
        } else {
            await finishAll()
        }
    }
    // Wait until an in-progress start/reconcile has released the actor gate.
    // The host must serialize new start commands with account/session changes.
    func endAll() async {
        while busy {
            try? await Task.sleep(nanoseconds: 10_000_000)
            if Task.isCancelled { return }
        }
        busy = true
        defer { busy = false }
        await finishAll()
    }
    private func removeExpired(now: Date) async {
        for item in Activity<GameReminderAttributes>.activities where !item.content.state.window.isValid(at: now) {
            await item.end(nil, dismissalPolicy: .immediate)
        }
    }
    private func finishAll() async {
        for item in Activity<GameReminderAttributes>.activities {
            await item.end(nil, dismissalPolicy: .immediate)
        }
    }
}
