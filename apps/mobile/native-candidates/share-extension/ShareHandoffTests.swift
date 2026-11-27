import Foundation

@main struct ShareHandoffTests {
    static func main() throws {
        let accepted = ["https://hoopcheck.online/teams", "https://hoopcheck.online/womens", "https://hoopcheck.online/leagues"]
        for raw in accepted { precondition(PublicShareRoute(url: URL(string: raw)!) != nil) }
        for raw in ["http://hoopcheck.online/teams", "https://hoopcheck.online.evil.example/teams", "https://evil.example/teams", "https://hoopcheck.online@evil.example/teams", "https://x@hoopcheck.online/teams", "https://hoopcheck.online:443/teams", "https://hoopcheck.online/teams?token=a", "https://hoopcheck.online/teams#x", "https://hoopcheck.online/%74eams", "https://hoopcheck.online/teams/", "https://hoopcheck.online/account", "https://hoopcheck.online/feed", "file:///teams", "hoopcheck://teams"] {
            precondition(PublicShareRoute(url: URL(string: raw)!) == nil, raw)
        }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        try ShareHandoffStore.write(.teams, to: folder, now: now)
        precondition(ShareHandoffStore.take(from: folder, now: now) == .teams)
        precondition(ShareHandoffStore.take(from: folder, now: now) == nil)
        try ShareHandoffStore.write(.teams, to: folder, now: now)
        try ShareHandoffStore.write(.leagues, to: folder, now: now)
        precondition(ShareHandoffStore.take(from: folder, now: now) == .leagues)
        try ShareHandoffStore.write(.womens, to: folder, now: now)
        precondition(ShareHandoffStore.take(from: folder, now: now.addingTimeInterval(601)) == nil)
        try ShareHandoffStore.write(.womens, to: folder, now: now.addingTimeInterval(1))
        precondition(ShareHandoffStore.take(from: folder, now: now) == nil)
        try Data(repeating: 65, count: 513).write(to: folder.appendingPathComponent(ShareHandoffStore.filename))
        precondition(ShareHandoffStore.take(from: folder, now: now) == nil)
        try Data("{\"route\":\"/account\",\"created\":0}".utf8).write(to: folder.appendingPathComponent(ShareHandoffStore.filename))
        precondition(ShareHandoffStore.take(from: folder, now: now) == nil)
        try ShareHandoffStore.write(.teams, to: folder, now: now)
        ShareHandoffStore.discard(in: folder)
        precondition(ShareHandoffStore.take(from: folder, now: now) == nil)
        print("Public share URL, bounded handoff, one-time consumption, expiry and discard passed.")
    }
}
