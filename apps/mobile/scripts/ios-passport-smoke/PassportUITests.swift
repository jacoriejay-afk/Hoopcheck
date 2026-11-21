import XCTest

@MainActor
final class PassportUITests: XCTestCase {
  func testNativePassportRenderShareAndCleanup() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "online.hoopcheck.app")
    app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
    app.launch()
    defer {
      let end = XCTAttachment(screenshot: app.screenshot())
      end.name = "passport-final-state"
      end.lifetime = .keepAlways
      add(end)
      print(app.debugDescription)
      app.terminate()
    }
    let prepare = app.buttons["passport-smoke-prepare"]
    XCTAssertTrue(prepare.waitForExistence(timeout: 90), "Standalone Metro entry must load")
    prepare.tap()
    let share = app.buttons["passport-smoke-share"]
    XCTAssertTrue(share.waitForExistence(timeout: 40), "Real Expo Print must generate a valid local PDF")
    let pdf = XCTAttachment(screenshot: app.screenshot())
    pdf.name = "native-pdf-ready"
    pdf.lifetime = .keepAlways
    add(pdf)
    share.tap()
    let activity = app.buttons.matching(NSPredicate(format: "label == 'Copy' OR label == 'Save to Files' OR label == 'AirDrop'")).firstMatch
    XCTAssertTrue(activity.waitForExistence(timeout: 20), "Real UIKit activity choices must appear")
    let sheet = XCTAttachment(screenshot: app.screenshot())
    sheet.name = "native-share-sheet"
    sheet.lifetime = .keepAlways
    add(sheet)
    let close = app.buttons["Close"].firstMatch
    XCTAssertTrue(close.waitForExistence(timeout: 10), "Dismiss without sharing to an external recipient")
    close.tap()
    XCTAssertTrue(app.staticTexts["CLEANED"].waitForExistence(timeout: 20), "Native dismissal must resolve and delete the generated PDF")
    XCTAssertEqual(XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.count, 0, "No system permission prompt is expected")
    XCTAssertEqual(app.alerts.count, 0, "PDF sharing must not request camera, library or tracking access")
  }
}
