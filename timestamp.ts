let BUFFER: string = '';

function base64Append(digit: number, haveNonZero: boolean): boolean {
    let encoded: number;

    if (digit > 0) {
        haveNonZero = true;
    }

    if (haveNonZero) {
        if (digit < 26) {
            encoded = 65 + digit;
        } else if (digit < 52) {
            encoded = 97 + digit - 26;
        } else if (digit < 62) {
            encoded = 48 + digit - 52
        } else if (digit == 62) {
            encoded = 36
        } else {
            encoded = 95
        }

        // Append to result
        BUFFER += String.fromCharCode(encoded & 65535)
    }

    return haveNonZero
}

/**
 * Thanks Google, I guess ?
 * @param longValue The long value to convert to base64
 */
function longToBase64(longValue: number): string {
    const low = longValue & 0xffffffff;
    const high = longValue >> 32;

    let haveNonZero = base64Append(~~high >> 28 & 15, false);

    haveNonZero = base64Append(~~high >> 22 & 63, haveNonZero);
    haveNonZero = base64Append(~~high >> 16 & 63, haveNonZero);
    haveNonZero = base64Append(~~high >> 10 & 63, haveNonZero);
    haveNonZero = base64Append(~~high >> 4 & 63, haveNonZero);

    const value = (high & 15) << 2 | ~~low >> 30 & 3;

    haveNonZero = base64Append(value, haveNonZero);
    haveNonZero = base64Append(~~low >> 24 & 63, haveNonZero);
    haveNonZero = base64Append(~~low >> 18 & 63, haveNonZero);
    haveNonZero = base64Append(~~low >> 12 & 63, haveNonZero);

    base64Append(~~low >> 6 & 63, haveNonZero);
    base64Append(low & 63, true);

    return BUFFER;
}

function getTimestamp(): string {
    BUFFER = "";
    const key = 0xc0ffee; // Really is new Date().getTime() in ADE but fuck this shit
    return longToBase64(key);
}

export {
    getTimestamp
};