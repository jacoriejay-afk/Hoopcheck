import XCTest

@MainActor
final class PassportUITests: XCTestCase {
  func testNativePassportRenderShareAndCleanup() throws {
    // Explicit guard returns preserve defer evidence on failures as well as success.
    continueAfterFailure = true
    let app = XCUIApplication(bundleIdentifier: "online.hoopcheck.app")
    // CI only: Xcode UI-test launches do not inherit Expo CLI's Metro host.
    // The simulator-only standalone fixture must use the local packager;
    // RCTBundleURLProvider reads RCT_jsLocation from launch argument defaults.
    // Do not alter production app startup or relax the real PDF/share tests.
    app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US",
                            "-RCT_jsLocation", "127.0.0.1:8081"]
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
    guard prepare.waitForExistence(timeout: 90) else {
      XCTFail("Standalone Metro entry must load"); return
    }
    prepare.tap()
    let share = app.buttons["passport-smoke-share"]
    guard share.waitForExistence(timeout: 105) else {
      // Check real PDF generation, not the 30s production UX timeout: a cold
      // CI simulator can take longer to start the native Print WebKit process.
      let state = app.staticTexts["passport-smoke-status"].label
      let detail = app.staticTexts["passport-smoke-detail"].label
      XCTFail("Real Expo Print did not generate a valid local PDF within the bounded CI window (state=\(state), detail=\(detail))"); return
    }
    let pdf = XCTAttachment(screenshot: app.screenshot())
    pdf.name = "native-pdf-ready"
    pdf.lifetime = .keepAlways
    add(pdf)
    share.tap()
    // Observed iOS 18 hierarchy: UIActivityViewController choices are Cells,
    // with a remote ActivityListView and header.closeButton, not app Buttons.
    let sheetRoot = app.otherElements.matching(identifier: "ActivityListView").firstMatch
    let activity = app.cells.matching(NSPredicate(format: "label == 'Copy' OR label == 'Save to Files' OR label == 'Print'")).firstMatch
    guard sheetRoot.waitForExistence(timeout: 20), activity.waitForExistence(timeout: 20) else {
      XCTFail("Real UIKit activity container and PDF action cells must appear"); return
    }
    let sheet = XCTAttachment(screenshot: app.screenshot())
    sheet.name = "native-share-sheet"
    sheet.lifetime = .keepAlways
    add(sheet)
    let close = app.buttons.matching(identifier: "header.closeButton").firstMatch
    guard close.waitForExistence(timeout: 10) else {
      XCTFail("Dismiss without sharing to an external recipient"); return
    }
    close.tap()
    let cleaned = app.staticTexts.matching(NSPredicate(format: "identifier == 'passport-smoke-status' AND label == 'CLEANED'")).firstMatch
    XCTAssertTrue(cleaned.waitForExistence(timeout: 20), "Native dismissal must resolve and delete the generated PDF")
    XCTAssertEqual(XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.count, 0, "No system permission prompt is expected")
    XCTAssertEqual(app.alerts.count, 0, "PDF sharing must not request camera, library or tracking access")
  }
}
