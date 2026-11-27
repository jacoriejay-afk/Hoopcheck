import UIKit
import UniformTypeIdentifiers

// Candidate extension principal class. No UIApplication, private APIs, networking,
// background activity, posting, or forced opening of the containing app.
final class ShareViewController: UIViewController {
    private let status = UILabel()
    private let save = UIButton(type: .system)
    private let cancel = UIButton(type: .system)
    private var route: PublicShareRoute?
    private var finished = false
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let heading = UILabel()
        heading.text = "Share to HoopCheck"
        heading.font = .preferredFont(forTextStyle: .headline)
        heading.adjustsFontForContentSizeCategory = true
        status.text = "Checking public directory link…"
        status.numberOfLines = 0
        status.font = .preferredFont(forTextStyle: .body)
        status.adjustsFontForContentSizeCategory = true
        save.setTitle("Save link for HoopCheck", for: .normal)
        save.isEnabled = false
        save.addTarget(self, action: #selector(confirm), for: .touchUpInside)
        cancel.setTitle("Cancel", for: .normal)
        cancel.addTarget(self, action: #selector(dismissShare), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [heading, status, save, cancel])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            save.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            cancel.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])
        guard let items = extensionContext?.inputItems as? [NSExtensionItem],
              items.count == 1, let attachments = items.first?.attachments,
              attachments.count == 1, let provider = attachments.first,
              provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) else {
            reject(); return
        }
        provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, error in
            // Never fetch or resolve a URL; reject plain text, other schemes and hosts.
            let candidate = error == nil ? (item as? URL).flatMap { PublicShareRoute(url: $0) } : nil
            DispatchQueue.main.async {
                guard let self, !self.finished else { return }
                guard let candidate else { self.reject(); return }
                self.route = candidate
                self.status.text = candidate.title + "\nOpen HoopCheck within 10 minutes to review the saved link. Nothing will be posted."
                self.save.isEnabled = true
            }
        }
    }
    private func reject() {
        route = nil
        save.isEnabled = false
        status.text = "Only public HoopCheck teams, women's teams and leagues directory links are supported."
    }
    @objc private func confirm() {
        guard !finished, let route else { return }
        save.isEnabled = false
        // Group registration is an explicit release prerequisite, not assumed.
        guard let group = Bundle.main.object(forInfoDictionaryKey: "HoopcheckShareAppGroup") as? String,
              group.hasPrefix("group."), let folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
        else { status.text = "Sharing is not configured on this device."; return }
        do {
            try ShareHandoffStore.write(route, to: folder)
            finished = true
            extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        } catch {
            status.text = "Could not save the link. Please try again."
            save.isEnabled = true
        }
    }
    @objc private func dismissShare() {
        guard !finished else { return }
        finished = true
        extensionContext?.cancelRequest(withError: NSError(domain: "HoopCheckShare", code: NSUserCancelledError))
    }
}
