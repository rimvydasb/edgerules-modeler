# String Built-in Functions Reference

## toString

Converting the number to string. Math operator `+` can be used for string concatenation, but both operands must be
strings.

```edgerules
"#" + toString(404)
```

**output:**

```json
"#404"
```

## substring

Substring starting at position

```edgerules
substring("foobar", 3)
```

**output:**

```json
"obar"
```

## substring (with length)

Substring with length

```edgerules
substring("foobar", -3, 2)
```

**output:**

```json
"ba"
```

## length

Number of characters.

```edgerules
length("foo")
```

**output:**

```json
3
```

## toUpperCase

To uppercase.

```edgerules
toUpperCase("aBc4")
```

**output:**

```json
"ABC4"
```

## toLowerCase

To lowercase.

```edgerules
toLowerCase("aBc4")
```

**output:**

```json
"abc4"
```

## substringBefore

String before match.

```edgerules
substringBefore("foobar", "bar")
```

**output:**

```json
"foo"
```

## substringAfter

String after match.

```edgerules
substringAfter("foobar", "ob")
```

**output:**

```json
"ar"
```

## contains

True if contains substring.

```edgerules
contains("foobar", "of")
```

**output:**

```json
false
```

## startsWith

Checks prefix.

```edgerules
startsWith("foobar", "fo")
```

**output:**

```json
true
```

## endsWith

Checks suffix.

```edgerules
endsWith("foobar", "r")
```

**output:**

```json
true
```

## regexSplit

Splits string by regex.

```edgerules
regexSplit("a   b c", "\s+")
```

**output:**

```json
["a", "b", "c"]
```

## split

Simple substring split.

```edgerules
split("a-b-c", "-")
```

**output:**

```json
["a", "b", "c"]
```

## trim

Trim whitespace.

```edgerules
trim("  hello  ")
```

**output:**

```json
"hello"
```

## regexReplace

Regex replace.

```edgerules
regexReplace('Hello 123 world 456', '\d+', 'X', 'g')
```

**output:**

```json
"Hello X world X"
```

## regexReplace (with flags)

Regex replace with flags.

```edgerules
regexReplace("Abcd", "ab", "xx", "i")
```

**output:**

```json
"xxcd"
```

## replace

Simple substring replace, case-insensitive.

```edgerules
replace("Abcd", "ab", "xx", "i")
```

**output:**

```json
"xxcd"
```

## replaceFirst

Replace first occurrence.

```edgerules
replaceFirst("foo bar foo", "foo", "baz")
```

**output:**

```json
"baz bar foo"
```

## replaceLast

Replace last occurrence.

```edgerules
replaceLast("foo bar foo", "foo", "baz")
```

**output:**

```json
"foo bar baz"
```

## charAt

Character at index.

```edgerules
charAt("Abcd", 2)
```

**output:**

```json
"c"
```

## charCodeAt

Unicode of character at index.

```edgerules
charCodeAt("Abcd", 2)
```

**output:**

```json
99
```

## indexOf

Index of substring, or -1 if not found.

```edgerules
indexOf("Abcd", "b")
```

**output:**

```json
1
```

## lastIndexOf

Last index of substring, or -1 if not found.

```edgerules
lastIndexOf("Abcb", "b")
```

**output:**

```json
3
```

## fromBase64

Decode from base64.

```edgerules
fromBase64("RWRnZVJ1bGVz")
```

**output:**

```json
"EdgeRules"
```

## toBase64

Encode to base64.

```edgerules
toBase64("EdgeRules")
```

**output:**

```json
"RWRnZVJ1bGVz"
```

## fromCharCode

Create string from Unicode values.

```edgerules
fromCharCode(99, 100, 101)
```

**output:**

```json
"cde"
```

## padStart

Pad string on left to length with char.

```edgerules
padStart("7", 3, "0")
```

**output:**

```json
"007"
```

## padEnd

Pad string on right to length with char.

```edgerules
padEnd("7", 3, "0")
```

**output:**

```json
"700"
```

## repeat

Repeat string N times.

```edgerules
repeat("ab", 3)
```

**output:**

```json
"ababab"
```

## reverse

Reverse string.

```edgerules
reverse("abc")
```

**output:**

```json
"cba"
```

## sanitizeFilename

Remove characters not allowed in filenames.

```edgerules
sanitizeFilename('a/b\\c:d*e?f\"g<h>ij.exe')
```

**output:**

```json
"abcdefghij.exe"
```

## interpolate

Template string interpolation.

```edgerules
interpolate("Hi ${name}", { name: "Ana" })
```

**output:**

```json
"Hi Ana"
```

## matchesPattern

Wildcard mask test, the regex-free format check: `#` matches a digit, `A` a letter, `?` any single character, `*` any
run of characters (including an empty one); every other mask character matches literally.

```edgerules
matchesPattern("LT-1234", "AA-####")
```

**output:**

```json
true
```

## luhn

Luhn checksum (payment cards, IMEI). Spaces and hyphens are ignored; any other non-digit, or fewer than two digits,
fails the check.

```edgerules
luhn("4111 1111 1111 1111")
```

**output:**

```json
true
```

## mod97

ISO 7064 mod-97-10 checksum as used by IBAN: the first four characters move to the end, letters map to 10–35, and the
resulting number must satisfy `mod 97 = 1`. Spaces are ignored and lowercase letters accepted.

```edgerules
mod97("GB82 WEST 1234 5698 7654 32")
```

**output:**

```json
true
```

## isNumeric

True for a non-empty string of ASCII digits only.

```edgerules
isNumeric("12345")
```

**output:**

```json
true
```

## isAlpha

True for a non-empty string of letters only (Unicode letters included).

```edgerules
isAlpha("Ąžuolas")
```

**output:**

```json
true
```

## isAlphanumeric

True for a non-empty string of letters and ASCII digits only.

```edgerules
isAlphanumeric("abc123")
```

**output:**

```json
true
```
