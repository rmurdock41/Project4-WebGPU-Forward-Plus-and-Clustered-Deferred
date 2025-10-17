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

    gBufferRenderBundle: GPURenderBundle;
    useRenderBundle: boolean = false;

    // Compute pass
    outputTexture: GPUTexture;
    outputTextureView: GPUTextureView;
    computeBindGroupLayout: GPUBindGroupLayout;
    computeBindGroup: GPUBindGroup;
    computePipeline: GPUComputePipeline;

    // Blit pass
    blitBindGroupLayout: GPUBindGroupLayout;
    blitBindGroup: GPUBindGroup;
    blitPipeline: GPURenderPipeline;

    // Bloom pass
    bloomBrightTexture: GPUTexture;
    bloomBrightTextureView: GPUTextureView;
    bloomBlurTemp1Texture: GPUTexture;
    bloomBlurTemp1TextureView: GPUTextureView;
    bloomBlurTemp2Texture: GPUTexture;
    bloomBlurTemp2TextureView: GPUTextureView;
    bloomOutputTexture: GPUTexture;
    bloomOutputTextureView: GPUTextureView;

    bloomBrightPassBindGroupLayout: GPUBindGroupLayout;
    bloomBrightPassBindGroup: GPUBindGroup;
    bloomBrightPassPipeline: GPUComputePipeline;

    bloomHBlurBindGroupLayout: GPUBindGroupLayout;
    bloomHBlurBindGroup: GPUBindGroup;
    bloomHBlurPipeline: GPUComputePipeline;

    bloomVBlurBindGroupLayout: GPUBindGroupLayout;
    bloomVBlurBindGroup: GPUBindGroup;
    bloomVBlurPipeline: GPUComputePipeline;

    bloomCompositeBindGroupLayout: GPUBindGroupLayout;
    bloomCompositeBindGroup: GPUBindGroup;
    bloomCompositePipeline: GPUComputePipeline;

    useBloom: boolean = true;
    blitBindGroupWithBloom: GPUBindGroup;
    useComputeShader: boolean = true;

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
                    { format: 'rgba16float' },
                    { format: 'rgba16float' },
                    { format: 'rgba16float' }
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

        this.gBufferRenderBundle = this.createGBufferRenderBundle();

        // Create output texture for compute shader
        this.outputTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.outputTextureView = this.outputTexture.createView();

        // Compute Pass Setup
        this.computeBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "compute bind group layout",
            entries: [
                { // camera
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "uniform" }
                },
                { // lightSet
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" }
                },
                { // clusterLights
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" }
                },
                { // gBufferPosition
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: { sampleType: 'unfilterable-float' }
                },
                { // gBufferNormal
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: { sampleType: 'unfilterable-float' }
                },
                { // gBufferAlbedo
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: { sampleType: 'unfilterable-float' }
                },
                { // outputTexture
                    binding: 6,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'write-only',
                        format: 'rgba8unorm'
                    }
                }
            ]
        });

        this.computeBindGroup = renderer.device.createBindGroup({
            label: "compute bind group",
            layout: this.computeBindGroupLayout,
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
                },
                {
                    binding: 6,
                    resource: this.outputTextureView
                }
            ]
        });

        this.computePipeline = renderer.device.createComputePipeline({
            label: "fullscreen compute pipeline",
            layout: renderer.device.createPipelineLayout({
                label: "compute pipeline layout",
                bindGroupLayouts: [this.computeBindGroupLayout]
            }),
            compute: {
                module: renderer.device.createShaderModule({
                    label: "fullscreen compute shader",
                    code: shaders.clusteredDeferredFullscreenComputeSrc
                }),
                entryPoint: "main"
            }
        });

        // Simple blit pipeline to copy compute output to canvas
        const blitShaderModule = renderer.device.createShaderModule({
            label: "blit shader",
            code: shaders.blitSrc
        });

        this.blitBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "blit bind group layout",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }
            }]
        });

        this.blitBindGroup = renderer.device.createBindGroup({
            label: "blit bind group",
            layout: this.blitBindGroupLayout,
            entries: [{
                binding: 0,
                resource: this.outputTextureView
            }]
        });

        this.blitPipeline = renderer.device.createRenderPipeline({
            label: "blit pipeline",
            layout: renderer.device.createPipelineLayout({
                label: "blit pipeline layout",
                bindGroupLayouts: [this.blitBindGroupLayout]
            }),
            vertex: {
                module: blitShaderModule,
                entryPoint: "vertMain"
            },
            fragment: {
                module: blitShaderModule,
                entryPoint: "fragMain",
                targets: [{ format: renderer.canvasFormat }]
            }
        });

        // Bloom Setup
        this.bloomBrightTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: 'rgba16float',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.bloomBrightTextureView = this.bloomBrightTexture.createView();

        this.bloomBlurTemp1Texture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: 'rgba16float',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.bloomBlurTemp1TextureView = this.bloomBlurTemp1Texture.createView();

        this.bloomBlurTemp2Texture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: 'rgba16float',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.bloomBlurTemp2TextureView = this.bloomBlurTemp2Texture.createView();

        this.bloomOutputTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.bloomOutputTextureView = this.bloomOutputTexture.createView();

        // Bright pass
        this.bloomBrightPassBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "bloom bright pass bind group layout",
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } }
            ]
        });

        this.bloomBrightPassBindGroup = renderer.device.createBindGroup({
            label: "bloom bright pass bind group",
            layout: this.bloomBrightPassBindGroupLayout,
            entries: [
                { binding: 0, resource: this.outputTextureView },
                { binding: 1, resource: this.bloomBrightTextureView }
            ]
        });

        this.bloomBrightPassPipeline = renderer.device.createComputePipeline({
            label: "bloom bright pass pipeline",
            layout: renderer.device.createPipelineLayout({ bindGroupLayouts: [this.bloomBrightPassBindGroupLayout] }),
            compute: {
                module: renderer.device.createShaderModule({
                    label: "bloom bright pass shader",
                    code: shaders.bloomComputeSrc
                }),
                entryPoint: "brightPass"
            }
        });

        // Horizontal blur
        this.bloomHBlurBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "bloom h blur bind group layout",
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } }
            ]
        });

        this.bloomHBlurBindGroup = renderer.device.createBindGroup({
            label: "bloom h blur bind group",
            layout: this.bloomHBlurBindGroupLayout,
            entries: [
                { binding: 0, resource: this.bloomBrightTextureView },
                { binding: 1, resource: this.bloomBlurTemp1TextureView }
            ]
        });

        this.bloomHBlurPipeline = renderer.device.createComputePipeline({
            label: "bloom h blur pipeline",
            layout: renderer.device.createPipelineLayout({ bindGroupLayouts: [this.bloomHBlurBindGroupLayout] }),
            compute: {
                module: renderer.device.createShaderModule({
                    label: "bloom h blur shader",
                    code: shaders.bloomComputeSrc
                }),
                entryPoint: "horizontalBlur"
            }
        });

        // Vertical blur
        this.bloomVBlurBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "bloom v blur bind group layout",
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } }
            ]
        });

        this.bloomVBlurBindGroup = renderer.device.createBindGroup({
            label: "bloom v blur bind group",
            layout: this.bloomVBlurBindGroupLayout,
            entries: [
                { binding: 0, resource: this.bloomBlurTemp1TextureView },
                { binding: 1, resource: this.bloomBlurTemp2TextureView }
            ]
        });

        this.bloomVBlurPipeline = renderer.device.createComputePipeline({
            label: "bloom v blur pipeline",
            layout: renderer.device.createPipelineLayout({ bindGroupLayouts: [this.bloomVBlurBindGroupLayout] }),
            compute: {
                module: renderer.device.createShaderModule({
                    label: "bloom v blur shader",
                    code: shaders.bloomComputeSrc
                }),
                entryPoint: "verticalBlur"
            }
        });

        // Composite pass
        this.bloomCompositeBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "bloom composite bind group layout",
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba8unorm' } }
            ]
        });

        this.bloomCompositeBindGroup = renderer.device.createBindGroup({
            label: "bloom composite bind group",
            layout: this.bloomCompositeBindGroupLayout,
            entries: [
                { binding: 0, resource: this.outputTextureView },
                { binding: 1, resource: this.bloomBlurTemp2TextureView },
                { binding: 2, resource: this.bloomOutputTextureView }
            ]
        });

        this.bloomCompositePipeline = renderer.device.createComputePipeline({
            label: "bloom composite pipeline",
            layout: renderer.device.createPipelineLayout({ bindGroupLayouts: [this.bloomCompositeBindGroupLayout] }),
            compute: {
                module: renderer.device.createShaderModule({
                    label: "bloom composite shader",
                    code: shaders.bloomComputeSrc
                }),
                entryPoint: "composite"
            }
        });

        // Update blit bind group to use bloom output when enabled
        this.blitBindGroupWithBloom = renderer.device.createBindGroup({
            label: "blit bind group with bloom",
            layout: this.blitBindGroupLayout,
            entries: [{
                binding: 0,
                resource: this.bloomOutputTextureView
            }]
        });
    }

    private createGBufferRenderBundle(): GPURenderBundle {
        const bundleEncoder = renderer.device.createRenderBundleEncoder({
            label: "G-buffer render bundle encoder",
            colorFormats: ['rgba16float', 'rgba16float', 'rgba16float'],
            depthStencilFormat: "depth24plus"
        });

        bundleEncoder.setPipeline(this.gBufferPipeline);
        bundleEncoder.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup);

        this.scene.iterate(node => {
            bundleEncoder.setBindGroup(shaders.constants.bindGroup_model, node.modelBindGroup);
        }, material => {
            bundleEncoder.setBindGroup(shaders.constants.bindGroup_material, material.materialBindGroup);
        }, primitive => {
            bundleEncoder.setVertexBuffer(0, primitive.vertexBuffer);
            bundleEncoder.setIndexBuffer(primitive.indexBuffer, 'uint32');
            bundleEncoder.drawIndexed(primitive.numIndices);
        });

        return bundleEncoder.finish();
    }

    override draw() {
        // TODO-3: run the Forward+ rendering pass:
        // - run the clustering compute shader
        // - run the G-buffer pass, outputting position, albedo, and normals
        // - run the fullscreen pass, which reads from the G-buffer and performs lighting calculations

        const encoder = renderer.device.createCommandEncoder();

        this.lights.doLightClustering(encoder);

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

        if (this.useRenderBundle) {
            gBufferPass.executeBundles([this.gBufferRenderBundle]);
        } else {
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
        }

        gBufferPass.end();

        if (this.useComputeShader) {
            // Compute shader path
            const computePass = encoder.beginComputePass({
                label: "fullscreen compute pass"
            });

            computePass.setPipeline(this.computePipeline);
            computePass.setBindGroup(0, this.computeBindGroup);

            const workgroupsX = Math.ceil(renderer.canvas.width / 8);
            const workgroupsY = Math.ceil(renderer.canvas.height / 8);
            computePass.dispatchWorkgroups(workgroupsX, workgroupsY);

            computePass.end();

            if (this.useBloom) {
                const brightPass = encoder.beginComputePass({ label: "bloom bright pass" });
                brightPass.setPipeline(this.bloomBrightPassPipeline);
                brightPass.setBindGroup(0, this.bloomBrightPassBindGroup);
                brightPass.dispatchWorkgroups(workgroupsX, workgroupsY);
                brightPass.end();

                const hBlurPass = encoder.beginComputePass({ label: "bloom horizontal blur pass" });
                hBlurPass.setPipeline(this.bloomHBlurPipeline);
                hBlurPass.setBindGroup(0, this.bloomHBlurBindGroup);
                hBlurPass.dispatchWorkgroups(workgroupsX, workgroupsY);
                hBlurPass.end();

                const vBlurPass = encoder.beginComputePass({ label: "bloom vertical blur pass" });
                vBlurPass.setPipeline(this.bloomVBlurPipeline);
                vBlurPass.setBindGroup(0, this.bloomVBlurBindGroup);
                vBlurPass.dispatchWorkgroups(workgroupsX, workgroupsY);
                vBlurPass.end();

                const compositePass = encoder.beginComputePass({ label: "bloom composite pass" });
                compositePass.setPipeline(this.bloomCompositePipeline);
                compositePass.setBindGroup(0, this.bloomCompositeBindGroup);
                compositePass.dispatchWorkgroups(workgroupsX, workgroupsY);
                compositePass.end();
            }

            // Blit compute output to canvas
            const canvasTextureView = renderer.context.getCurrentTexture().createView();
            const blitPass = encoder.beginRenderPass({
                label: "blit pass",
                colorAttachments: [{
                    view: canvasTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                }]
            });

            blitPass.setPipeline(this.blitPipeline);
            blitPass.setBindGroup(0, this.useBloom ? this.blitBindGroupWithBloom : this.blitBindGroup);
            blitPass.draw(3);
            blitPass.end();
        } else {
            // Traditional fullscreen render pass
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
        }

        renderer.device.queue.submit([encoder.finish()]);
    }
}