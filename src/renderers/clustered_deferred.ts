import * as renderer from '../renderer';
import * as shaders from '../shaders/shaders';
import { Stage } from '../stage/stage';

export class ClusteredDeferredRenderer extends renderer.Renderer {
    // TODO-3: add layouts, pipelines, textures, etc. needed for Forward+ here
    // you may need extra uniforms such as the camera view matrix and the canvas resolution

    // G-buffer texture
    gBufferPositionTexture: GPUTexture;
    gBufferNormalTexture: GPUTexture;
    gBufferAlbedoTexture: GPUTexture;

    gBufferPositionTextureView: GPUTextureView;
    gBufferNormalTextureView: GPUTextureView;
    gBufferAlbedoTextureView: GPUTextureView;

    depthTexture: GPUTexture;
    depthTextureView: GPUTextureView;

    // G-buffer pass
    sceneUniformsBindGroupLayout: GPUBindGroupLayout;
    sceneUniformsBindGroup: GPUBindGroup;
    gBufferPipeline: GPURenderPipeline;

    // Fullscreen pass
    fullscreenBindGroupLayout: GPUBindGroupLayout;
    fullscreenBindGroup: GPUBindGroup;
    fullscreenPipeline: GPURenderPipeline;


    constructor(stage: Stage) {
        super(stage);

        // TODO-3: initialize layouts, pipelines, textures, etc. needed for Forward+ here
        // you'll need two pipelines: one for the G-buffer pass and one for the fullscreen pass

        const gBufferTextureDesc: GPUTextureDescriptor = {
            size: [renderer.canvas.width, renderer.canvas.height],
            format: 'rgba16float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        };

        this.gBufferPositionTexture = renderer.device.createTexture(gBufferTextureDesc);
        this.gBufferNormalTexture = renderer.device.createTexture(gBufferTextureDesc);
        this.gBufferAlbedoTexture = renderer.device.createTexture(gBufferTextureDesc);

        this.gBufferPositionTextureView = this.gBufferPositionTexture.createView();
        this.gBufferNormalTextureView = this.gBufferNormalTexture.createView();
        this.gBufferAlbedoTextureView = this.gBufferAlbedoTexture.createView();

        this.depthTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.depthTextureView = this.depthTexture.createView();

        // G-buffer Pass Setup
        this.sceneUniformsBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "G-buffer scene uniforms bind group layout",
            entries: [
                { // camera
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "uniform" }
                }
            ]
        });

        this.sceneUniformsBindGroup = renderer.device.createBindGroup({
            label: "G-buffer scene uniforms bind group",
            layout: this.sceneUniformsBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.camera.uniformsBuffer }
                }
            ]
        });

        this.gBufferPipeline = renderer.device.createRenderPipeline({
            layout: renderer.device.createPipelineLayout({
                label: "G-buffer pipeline layout",
                bindGroupLayouts: [
                    this.sceneUniformsBindGroupLayout,
                    renderer.modelBindGroupLayout,
                    renderer.materialBindGroupLayout
                ]
            }),
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus"
            },
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "G-buffer vert shader",
                    code: shaders.naiveVertSrc  
                }),
                entryPoint: "main", 
                buffers: [renderer.vertexBufferLayout]
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "G-buffer frag shader",
                    code: shaders.clusteredDeferredFragSrc
                }),
                entryPoint: "main",
                targets: [
                    { format: 'rgba16float' },  // position
                    { format: 'rgba16float' },  // normal
                    { format: 'rgba16float' }   // albedo
                ]
            }
        });

        // Fullscreen Pass Setup 
        this.fullscreenBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "fullscreen bind group layout",
            entries: [
                { // camera
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" }
                },
                { // lightSet
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }
                },
                { // clusterLights
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }
                },
                { // gBufferPosition
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'unfilterable-float' }
                },
                { // gBufferNormal
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'unfilterable-float' }
                },
                { // gBufferAlbedo
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'unfilterable-float' }
                }
            ]
        });

        this.fullscreenBindGroup = renderer.device.createBindGroup({
            label: "fullscreen bind group",
            layout: this.fullscreenBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.camera.uniformsBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.lights.lightSetStorageBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: this.lights.clusterLightsBuffer }
                },
                {
                    binding: 3,
                    resource: this.gBufferPositionTextureView
                },
                {
                    binding: 4,
                    resource: this.gBufferNormalTextureView
                },
                {
                    binding: 5,
                    resource: this.gBufferAlbedoTextureView
                }
            ]
        });



        this.fullscreenPipeline = renderer.device.createRenderPipeline({
            layout: renderer.device.createPipelineLayout({
                label: "fullscreen pipeline layout",
                bindGroupLayouts: [this.fullscreenBindGroupLayout]
            }),
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "fullscreen vert shader",
                    code: shaders.clusteredDeferredFullscreenVertSrc
                }),
                entryPoint: "main" 
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "fullscreen frag shader",
                    code: shaders.clusteredDeferredFullscreenFragSrc
                }),
                entryPoint: "main",
                targets: [
                    {
                        format: renderer.canvasFormat
                    }
                ]
            }
        });

}

    override draw() {

        // TODO-3: run the Forward+ rendering pass:
        // - run the clustering compute shader
        // - run the G-buffer pass, outputting position, albedo, and normals
        // - run the fullscreen pass, which reads from the G-buffer and performs lighting calculations

        const encoder = renderer.device.createCommandEncoder();

        // Run clustering compute shader 
        this.lights.doLightClustering(encoder);

        // G-buffer Pass
        const gBufferPass = encoder.beginRenderPass({
            label: "G-buffer pass",
            colorAttachments: [
                {
                    view: this.gBufferPositionTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                },
                {
                    view: this.gBufferNormalTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                },
                {
                    view: this.gBufferAlbedoTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                }
            ],
            depthStencilAttachment: {
                view: this.depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store"
            }
        });

        gBufferPass.setPipeline(this.gBufferPipeline);
        gBufferPass.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup);

        this.scene.iterate(node => {
            gBufferPass.setBindGroup(shaders.constants.bindGroup_model, node.modelBindGroup);
        }, material => {
            gBufferPass.setBindGroup(shaders.constants.bindGroup_material, material.materialBindGroup);
        }, primitive => {
            gBufferPass.setVertexBuffer(0, primitive.vertexBuffer);
            gBufferPass.setIndexBuffer(primitive.indexBuffer, 'uint32');
            gBufferPass.drawIndexed(primitive.numIndices);
        });

        gBufferPass.end();

        // ====== Step 3: Fullscreen Pass ======
        const canvasTextureView = renderer.context.getCurrentTexture().createView();

        const fullscreenPass = encoder.beginRenderPass({
            label: "fullscreen pass",
            colorAttachments: [
                {
                    view: canvasTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                }
            ]
        });

        fullscreenPass.setPipeline(this.fullscreenPipeline);
        fullscreenPass.setBindGroup(0, this.fullscreenBindGroup);
        fullscreenPass.draw(3);  

        fullscreenPass.end();

        renderer.device.queue.submit([encoder.finish()]);
    
    }
}
