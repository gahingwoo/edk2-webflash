#!/bin/sh
# Download the UEFI images of the latest edk2-rk3576 release into SITE under
# fixed names, check them against the release's SHA256SUMS.txt, and write
# SITE/firmware.json with the release tag and each image's own version.
#   sh scripts/bundle-firmware.sh _site
# Needs gh (with GH_TOKEN in CI) and sha256sum.
set -eu
SITE="$1"
REPO=gahingwoo/edk2-rk3576
TAG=$(gh release view --repo "$REPO" --json tagName -q .tagName)
FW=$(mktemp -d)
trap 'rm -rf "$FW"' EXIT
gh release download "$TAG" --repo "$REPO" --dir "$FW" \
  --pattern 'ROCK4D-spi-edk2-*.img' \
  --pattern 'CM5IO-emmc-edk2-*.img' \
  --pattern 'TaishanPi3M-emmc-edk2-*.img' \
  --pattern 'SHA256SUMS.txt'
( cd "$FW" && sha256sum -c --ignore-missing SHA256SUMS.txt )

# one PREFIX: the single file PREFIX<version>.img; prints its version.
one() {
  set -- "$FW"/"$1"*.img
  [ "$#" -eq 1 ] && [ -f "$1" ] || { echo "expected one match, got: $*" >&2; exit 1; }
  echo "$1"
}
version() { basename "$1" .img | sed "s/^$2//"; }

R=$(one ROCK4D-spi-edk2-);      RV=$(version "$R" ROCK4D-spi-edk2-)
C=$(one CM5IO-emmc-edk2-);      CV=$(version "$C" CM5IO-emmc-edk2-)
T=$(one TaishanPi3M-emmc-edk2-); TV=$(version "$T" TaishanPi3M-emmc-edk2-)
cp "$R" "$SITE/rock4d-spi-edk2.img"
cp "$C" "$SITE/cm5io-emmc-edk2.img"
cp "$T" "$SITE/tspi3m-emmc-edk2.img"
printf '{"release":"%s","images":{"rock4d":"%s","cm5io":"%s","tspi3m":"%s"}}\n' "$TAG" "$RV" "$CV" "$TV" > "$SITE/firmware.json"
cat "$SITE/firmware.json"
