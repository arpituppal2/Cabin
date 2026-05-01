// MetalBridge.swift
// Owns the Metal texture that drives M_IFEScreen inside Unreal Engine.
// Each CADisplayLink frame:
//   1. Renders the current IFEMode SwiftUI view into an offscreen MTLTexture
//      via ImageRenderer (iOS 16+).
//   2. Calls CabinBridge_UpdateIFETexture with the texture handle so UE
//      can blit it onto the IFE plane in the cabin scene.
//
// Texture spec: BGRA8Unorm, 2560x1440 (matches the virtual 24" 4K OLED bezel).
// IOSurface-backed so the Metal blit in IFETextureUpdater.cpp is zero-copy.

import MetalKit
import SwiftUI

@MainActor
final class MetalBridge: ObservableObject {

    // MARK: - Constants
    private let textureWidth  = 2560
    private let textureHeight = 1440

    // MARK: - Metal objects
    private let device:       MTLDevice
    private var texture:      MTLTexture?
    private let commandQueue: MTLCommandQueue

    // MARK: - SwiftUI renderer
    // ImageRenderer renders SwiftUI views into a CGImage, which we upload to MTLTexture.
    private let renderer: ImageRenderer<AnyView>
    private var pendingView: AnyView?

    // MARK: - Init
    init() {
        guard
            let dev = MTLCreateSystemDefaultDevice(),
            let queue = dev.makeCommandQueue()
        else {
            fatalError("[MetalBridge] No Metal device available.")
        }
        device = dev
        commandQueue = queue
        renderer = ImageRenderer(content: AnyView(EmptyView()))
        renderer.scale = 2.0  // Retina scale.
        texture = makeTexture()
    }

    // MARK: - Texture creation

    private func makeTexture() -> MTLTexture? {
        let desc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .bgra8Unorm_srgb,
            width: textureWidth,
            height: textureHeight,
            mipmapped: false
        )
        desc.usage = [.shaderRead, .shaderWrite, .renderTarget]
        desc.storageMode = .shared   // CPU + GPU accessible — required for ImageRenderer upload.
        return device.makeTexture(descriptor: desc)
    }

    // MARK: - Per-frame flush (called by SessionEngine's CADisplayLink)

    func flushIFETexture(
        ifeMode:   IFEMode,
        telemetry: TelemetrySnapshot,
        phase:     CabinPhase
    ) {
        guard let texture else { return }

        // Build the SwiftUI view for this IFE mode.
        let ifeView = buildIFEView(mode: ifeMode, telemetry: telemetry, phase: phase)
            .frame(width: CGFloat(textureWidth) / 2, height: CGFloat(textureHeight) / 2)

        renderer.content = AnyView(ifeView)

        // Render to CGImage.
        guard let cgImage = renderer.cgImage else { return }

        // Upload CGImage pixels into the Metal texture.
        uploadCGImage(cgImage, to: texture)

        // Notify UE — cast pointer to Int64 for C ABI.
        let handle = Int64(bitPattern: UInt64(UInt(bitPattern: Unmanaged.passUnretained(texture).toOpaque())))
        CabinBridge_UpdateIFETexture(handle, Int32(textureWidth), Int32(textureHeight))
    }

    // MARK: - CGImage → MTLTexture upload

    private func uploadCGImage(_ image: CGImage, to texture: MTLTexture) {
        let bytesPerRow = textureWidth * 4
        guard
            let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
            let context = CGContext(
                data: nil,
                width: textureWidth,
                height: textureHeight,
                bitsPerComponent: 8,
                bytesPerRow: bytesPerRow,
                space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                    | CGBitmapInfo.byteOrder32Little.rawValue
            )
        else { return }

        context.draw(image, in: CGRect(x: 0, y: 0, width: textureWidth, height: textureHeight))

        guard let data = context.data else { return }
        texture.replace(
            region: MTLRegionMake2D(0, 0, textureWidth, textureHeight),
            mipmapLevel: 0,
            withBytes: data,
            bytesPerRow: bytesPerRow
        )
    }

    // MARK: - IFE view factory

    @ViewBuilder
    private func buildIFEView(
        mode: IFEMode,
        telemetry: TelemetrySnapshot,
        phase: CabinPhase
    ) -> some View {
        switch mode {
        case .flightMap:  IFEFlightMapView(telemetry: telemetry, phase: phase)
        case .bigClock:   IFEBigClockView(telemetry: telemetry)
        case .tailCamera: IFETailCameraView(phase: phase)
        }
    }
}
