// TODO-3: implement the Clustered Deferred fullscreen vertex shader

// This shader should be very simple as it does not need all of the information passed by the the naive vertex shader.

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;

    let uv = vec2f(
        f32((vertexIndex << 1u) & 2u),
        f32(vertexIndex & 2u)
    );
    
    output.position = vec4f(uv * 2.0 - 1.0, 0.0, 1.0);
    output.uv = uv;
    
    return output;
}