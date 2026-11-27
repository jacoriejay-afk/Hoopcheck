import ActivityKit
import SwiftUI
import WidgetKit

@available(iOSApplicationExtension 16.2, *)
struct GameReminderWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GameReminderAttributes.self) { context in
            VStack(alignment: .leading, spacing: 6) {
                Text("HoopCheck · Game reminder").font(.headline)
                countdown(context)
                Text("Your timer, not a verified game start or live score.").font(.caption)
            }
            .padding()
            .activityBackgroundTint(Color.black)
            .activitySystemActionForegroundColor(Color.white)
            .foregroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "basketball") }
                DynamicIslandExpandedRegion(.trailing) { countdown(context) }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Personal game reminder · check schedule").font(.caption)
                }
            } compactLeading: {
                Image(systemName: "basketball").accessibilityLabel("HoopCheck game reminder")
            } compactTrailing: {
                countdown(context).font(.caption2)
            } minimal: {
                Image(systemName: "timer").accessibilityLabel("Personal game reminder")
            }
            .keylineTint(Color.orange)
        }
    }
    @ViewBuilder private func countdown(_ context: ActivityViewContext<GameReminderAttributes>) -> some View {
        let window = context.state.window
        if context.isStale || !window.isValid(at: Date()) {
            Text("Check schedule").font(.caption).accessibilityLabel("Reminder finished. Check the current schedule.")
        } else {
            Text(timerInterval: window.started...window.deadline, countsDown: true)
                .monospacedDigit()
                .accessibilityLabel("Personal reminder countdown")
        }
    }
}
