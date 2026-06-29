export function ok(data) {
    return { ok: true, data };
}
export function fail(code, message) {
    return { ok: false, error: { code, message } };
}
