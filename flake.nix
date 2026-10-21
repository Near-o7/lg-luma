{
  description = "Luma web and Rust/SDL2 development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, rust-overlay, ... }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system:
        f (import nixpkgs { inherit system; overlays = [ rust-overlay.overlays.default ]; }));
      project = builtins.fromJSON (builtins.readFile ./package.json);
      pnpmVersion = nixpkgs.lib.removePrefix "pnpm@" project.packageManager;
    in {
      devShells = forEachSystem (pkgs:
        let
          # Match the native CI toolchain and include the TV's soft-float Rust std.
          rust = pkgs.rust-bin.stable."1.93.0".default.override {
            extensions = [ "clippy" "rustfmt" ];
            targets = [ "armv7-unknown-linux-gnueabi" ];
          };
          pnpm = assert pkgs.lib.assertMsg (pkgs.pnpm_10.version == pnpmVersion)
            "The flake's pnpm must match package.json; update flake.lock and packageManager together.";
            pkgs.pnpm_10;
          browsers = assert pkgs.lib.assertMsg
            (pkgs.playwright-driver.version == project.devDependencies."@playwright/test")
            "The flake's Playwright browsers must match @playwright/test; update flake.lock with that dependency.";
            pkgs.playwright-driver.browsers;
        in {
          default = pkgs.mkShell ({
            name = "luma";
            packages = [
              pkgs.nodejs_24
              pnpm
              rust
              pkgs.pkg-config
              pkgs.SDL2
              pkgs.woff2
              (pkgs.python3.withPackages (python: [ python.fonttools ]))
              pkgs.cmake
              pkgs.git
            ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
              pkgs.libGL
              pkgs.mesa
              pkgs.xvfb-run
            ];
          } // pkgs.lib.optionalAttrs pkgs.stdenv.isLinux {
            # Nix-built browsers carry their runtime libraries on Linux.
            PLAYWRIGHT_BROWSERS_PATH = "${browsers}";
          });
        });

      formatter = forEachSystem (pkgs: pkgs.nixfmt);
    };
}
