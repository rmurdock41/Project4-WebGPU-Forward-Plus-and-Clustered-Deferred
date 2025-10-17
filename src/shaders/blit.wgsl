struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f
}

@vertex
fn vertMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    let uv = vec2f(
        f32((vertexIndex << 1u) & 2u),
        f32(vertexIndex & 2u)
    );
    output.position = vec4f(uv * 2.0 - 1.0, 0.0, 1.0);
    output.uv = uv;
    return output;
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;

@fragment
fn fragMain(in: VertexOutput) -> @location(0) vec4f {
    let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
    return textureLoad(inputTexture, vec2i(uv * vec2f(textureDimensions(inputTexture))), 0);
}