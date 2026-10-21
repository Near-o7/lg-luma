#!/bin/sh
set -eu

# Use the webOS NDK's ARM soft-float ABI and sysroot for Rust AND SDL linking.
: "${WEBOS_NDK:?Set WEBOS_NDK to the extracted and relocated webOS native toolchain}"
ROOT=$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")
WEBOS_NDK=$(realpath "$WEBOS_NDK")
CC="$WEBOS_NDK/bin/arm-webos-linux-gnueabi-gcc"
[ -x "$CC" ] || { printf '%s\n' "Missing webOS compiler: $CC" >&2; exit 1; }
SYSROOT=$("$CC" -print-sysroot)
# Some relocated macOS SDKs report a nonexistent compiler-relative sysroot.
if [ ! -f "$SYSROOT/usr/include/stdint.h" ]; then
  SYSROOT="$WEBOS_NDK/arm-webos-linux-gnueabi/sysroot"
fi
[ -f "$SYSROOT/usr/include/stdint.h" ] || { printf '%s\n' "Missing webOS sysroot headers: $SYSROOT" >&2; exit 1; }
export CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABI_LINKER="$CC"
export CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABI_RUSTFLAGS="${CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABI_RUSTFLAGS:-} -C link-arg=--sysroot=$SYSROOT -C link-arg=-Wl,-rpath,\$ORIGIN/lib"
export CC_armv7_unknown_linux_gnueabi="$CC"
export AR_armv7_unknown_linux_gnueabi="$WEBOS_NDK/bin/arm-webos-linux-gnueabi-ar"
export CFLAGS_armv7_unknown_linux_gnueabi="${CFLAGS_armv7_unknown_linux_gnueabi:-} --sysroot=$SYSROOT"
export PKG_CONFIG_ALLOW_CROSS=1
# Nix's desktop SDL pkg-config path must not leak into this ARM build.
export PKG_CONFIG_PATH=
export PKG_CONFIG_SYSROOT_DIR="$SYSROOT"
export PKG_CONFIG_LIBDIR="$SYSROOT/usr/lib/pkgconfig:$SYSROOT/usr/share/pkgconfig"
exec cargo build --locked --manifest-path "$ROOT/native/Cargo.toml" --target armv7-unknown-linux-gnueabi --features webos --release
