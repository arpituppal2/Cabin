// MetalBridge.swift
// Swift-side Metal helper that owns the IFE texture render pipeline.
// The current implementation uses ImageRenderer (SwiftUI -> CGImage -> Metal)
// for clarity and rapid iteration. This is acceptable for the first exportable
// repo and can later be replaced with a custom RenderPass-based vector renderer
// for lower CPU overhead.

import SwiftUI
import Metal
import MetalKit
import CoreGraphics

@MainActor
final class MetalBridge: ObservableObject {

    static let shared = MetalBridge()

    let device: MTLDevice
    let commandQueue: MTLCommandQueue

    private init?() {
        guard let dev = MTLCreateSystemDefaultDevice(),
              let queue = dev.makeCommandQueue() else {
            return nil
        }
        self.device = dev
        self.commandQueue = queue
    }

    // Creates a CabinIFETexture at the given pixel size.
    func makeIFETexture(width: Int, height: Int) -> CabinIFETexture? {
        CabinIFETexture(device: device, width: width, height: height)
    }

    // Renders any SwiftUI view hierarchy into the supplied Metal texture.
    // This path is simple and reliable for the diegetic UI prototype.
    func render<V: View>(_ view: V, into texture: CabinIFETexture, scale: CGFloat = 2.0) {
        let renderer = ImageRenderer(content: view)
        renderer.scale = scale
        renderer.proposedSize = .init(width: CGFloat(texture.width), height: CGFloat(texture.height))
        renderer.isOpaque = true

        guard let cgImage = renderer.cgImage else { return }

        let bytesPerPixel = 4
        let bytesPerRow = texture.width * bytesPerPixel
        let totalBytes = bytesPerRow * texture.height
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: nil,
            width: texture.width,
            height: texture.height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return
        }

        ctx.interpolationQuality = .high
        ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: texture.width, height: texture.height))
        guard let data = ctx.data else { return }

        texture.texture.replace(
            region: MTLRegionMake2D(0, 0, texture.width, texture.height),
            mipmapLevel: 0,
            withBytes: data,
            bytesPerRow: bytesPerRow
        )

        _ = totalBytes // Intentional: useful during future perf instrumentation.
    }
}
