import Foundation

// No user content, tokens, network calls or private identifiers are persisted.
// The only accepted inputs are exact, public HoopCheck directory URLs.
enum PublicShareRoute: String, Codable, CaseIterable {
    case teams = "/teams"
    case womens = "/womens"
    case leagues = "/leagues"
    init?(url: URL) {
        guard let c = URLComponents(url: url, resolvingAgainstBaseURL: false),
              c.scheme == "https", c.host == "hoopcheck.online",
              c.user == nil, c.password == nil, c.port == nil,
              c.percentEncodedQuery == nil, c.percentEncodedFragment == nil,
              let route = Self(rawValue: c.percentEncodedPath),
              url.absoluteString == "https://hoopcheck.online" + route.rawValue
        else { return nil }
        self = route
    }
    var title: String {
        switch self {
        case .teams: return "Men's teams"
        case .womens: return "Women's teams"
        case .leagues: return "Leagues"
        }
    }
}
struct ShareHandoff: Codable, Equatable {
    let route: PublicShareRoute
    let created: Date
    static let lifetime: TimeInterval = 600
    func valid(at now: Date) -> Bool {
        let age = now.timeIntervalSince(created)
        return age.isFinite && age >= 0 && age <= Self.lifetime
    }
}
enum ShareHandoffStore {
    static let filename = "hoopcheck-public-link-v1.json"
    static func write(_ route: PublicShareRoute, to directory: URL, now: Date = Date()) throws {
        let item = ShareHandoff(route: route, created: now)
        let data = try JSONEncoder().encode(item)
        // Atomic replacement; exactly one pending public destination. No queue.
        #if os(iOS)
        try data.write(to: directory.appendingPathComponent(filename), options: [.atomic, .completeFileProtection])
        #else
        try data.write(to: directory.appendingPathComponent(filename), options: .atomic)
        #endif
    }
    static func take(from directory: URL, now: Date = Date()) -> PublicShareRoute? {
        let source = directory.appendingPathComponent(filename)
        // Claim the item by an atomic move; never read then delete a newer share.
        let claim = directory.appendingPathComponent("hoopcheck-public-link-claimed-" + UUID().uuidString + ".json")
        do { try FileManager.default.moveItem(at: source, to: claim) } catch { return nil }
        defer { try? FileManager.default.removeItem(at: claim) }
        guard let size = try? claim.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              size > 0, size <= 512,
              let data = try? Data(contentsOf: claim), data.count <= 512,
              let item = try? JSONDecoder().decode(ShareHandoff.self, from: data), item.valid(at: now)
        else { return nil }
        return item.route
    }
    static func discard(in directory: URL) {
        try? FileManager.default.removeItem(at: directory.appendingPathComponent(filename))
    }
}
