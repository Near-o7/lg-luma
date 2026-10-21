uniform sampler2D u_texture;
uniform float u_aa;
varying vec2 v_uv;
varying vec4 v_color;
varying vec4 v_shape;
varying vec2 v_params;
void main() {
    float radius = min(v_params.x, min(v_shape.z, v_shape.w));
    vec2 q = abs(v_shape.xy) - v_shape.zw + vec2(radius);
    float d = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
    float alpha = 1.0 - smoothstep(-u_aa, 0.0, d);
    if (v_params.y > 0.0) {
        alpha *= smoothstep(-v_params.y - u_aa, -v_params.y, d);
    }
    gl_FragColor = texture2D(u_texture, v_uv) * v_color * vec4(1.0, 1.0, 1.0, alpha);
}
