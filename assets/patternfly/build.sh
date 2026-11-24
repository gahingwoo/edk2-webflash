#!/bin/sh
# Assemble patternfly-flash.css from the parts of @patternfly/patternfly this
# page uses, so it does not ship the full bundle. Run from the repo root with
# the unpacked package directory as the only argument:
#   npm pack @patternfly/patternfly@6 && tar xzf patternfly-patternfly-*.tgz
#   sh assets/patternfly/build.sh package
# No npm at hand:
#   curl -sL https://registry.npmjs.org/@patternfly/patternfly/-/patternfly-<version>.tgz | tar xz
set -e
PKG="$1"; OUT=assets/patternfly
VERSION=$(grep -o '"version": *"[^"]*"' "$PKG/package.json" | cut -d'"' -f4)
{
  echo "/* Built by assets/patternfly/build.sh from @patternfly/patternfly $VERSION. Do not edit. */"
  cat "$PKG/patternfly-base.css"
  for c in Page/page Masthead/masthead Wizard/wizard Button/button Title/title Content/content \
           Table/table Table/table-grid Radio/radio Check/check Form/form HelperText/helper-text \
           Alert/alert Progress/progress DescriptionList/description-list List/list \
           ExpandableSection/expandable-section CodeBlock/code-block ActionList/action-list \
           ToggleGroup/toggle-group; do
    cat "$PKG/components/$c.css"
  done
  for l in Stack/stack; do cat "$PKG/layouts/$l.css"; done
} > "$OUT/patternfly-flash.css"
echo "$VERSION" > "$OUT/VERSION"
# The variable fonts the base stylesheet names. The icon fonts and background
# images it also names are not used by this page and are left out.
for f in RedHatDisplay/RedHatDisplayVF RedHatDisplay/RedHatDisplayVF-Italic RedHatText/RedHatTextVF \
         RedHatText/RedHatTextVF-Italic RedHatMono/RedHatMonoVF RedHatMono/RedHatMonoVF-Italic; do
  mkdir -p "$OUT/assets/fonts/$(dirname $f)"
  cp "$PKG/assets/fonts/$f.woff2" "$OUT/assets/fonts/$f.woff2"
done
wc -c "$OUT/patternfly-flash.css"
