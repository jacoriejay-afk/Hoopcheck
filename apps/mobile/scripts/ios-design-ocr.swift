import AppKit
import Vision

let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
try VNImageRequestHandler(url: url).perform([request])
let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined()
let normalized = text.lowercased().filter { $0.isLetter || $0.isNumber }
guard normalized.contains(CommandLine.arguments[2]) else {
    fputs("Expected screen content absent: \(CommandLine.arguments[2]); OCR: \(text)\n", stderr)
    exit(1)
}
print("PASS native screen content: \(CommandLine.arguments[2])")
