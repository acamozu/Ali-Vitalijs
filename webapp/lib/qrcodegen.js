// QR Code generator library by Project Nayuki (MIT licence - see qrcodegen.LICENSE.txt), in the version that
// qrcode.react 4.2.0 bundles (the web version draws its QR code with it), so both apps draw the same code.
// Taken from node_modules/qrcode.react/lib/esm/index.js (part "src/third-party/qrcodegen"), converted to ES5
// with the TypeScript compiler (tsc --allowJs --target ES5); the only change is the module wrapper.
sap.ui.define([], function () {

var qrcodegen;
(function (qrcodegen2) {
    var _QrCode = /** @class */ (function () {
        /*-- Constructor (low level) and fields --*/
        // Creates a new QR Code with the given version number,
        // error correction level, data codeword bytes, and mask number.
        // This is a low-level API that most users should not use directly.
        // A mid-level API is the encodeSegments() function.
        function _QrCode(version, errorCorrectionLevel, dataCodewords, msk) {
            this.version = version;
            this.errorCorrectionLevel = errorCorrectionLevel;
            // The modules of this QR Code (false = light, true = dark).
            // Immutable after constructor finishes. Accessed through getModule().
            this.modules = [];
            // Indicates function modules that are not subjected to masking. Discarded when constructor finishes.
            this.isFunction = [];
            if (version < _QrCode.MIN_VERSION || version > _QrCode.MAX_VERSION)
                throw new RangeError("Version value out of range");
            if (msk < -1 || msk > 7)
                throw new RangeError("Mask value out of range");
            this.size = version * 4 + 17;
            var row = [];
            for (var i = 0; i < this.size; i++)
                row.push(false);
            for (var i = 0; i < this.size; i++) {
                this.modules.push(row.slice());
                this.isFunction.push(row.slice());
            }
            this.drawFunctionPatterns();
            var allCodewords = this.addEccAndInterleave(dataCodewords);
            this.drawCodewords(allCodewords);
            if (msk == -1) {
                var minPenalty = 1e9;
                for (var i = 0; i < 8; i++) {
                    this.applyMask(i);
                    this.drawFormatBits(i);
                    var penalty = this.getPenaltyScore();
                    if (penalty < minPenalty) {
                        msk = i;
                        minPenalty = penalty;
                    }
                    this.applyMask(i);
                }
            }
            assert(0 <= msk && msk <= 7);
            this.mask = msk;
            this.applyMask(msk);
            this.drawFormatBits(msk);
            this.isFunction = [];
        }
        /*-- Static factory functions (high level) --*/
        // Returns a QR Code representing the given Unicode text string at the given error correction level.
        // As a conservative upper bound, this function is guaranteed to succeed for strings that have 738 or fewer
        // Unicode code points (not UTF-16 code units) if the low error correction level is used. The smallest possible
        // QR Code version is automatically chosen for the output. The ECC level of the result may be higher than the
        // ecl argument if it can be done without increasing the version.
        _QrCode.encodeText = function (text, ecl) {
            var segs = qrcodegen2.QrSegment.makeSegments(text);
            return _QrCode.encodeSegments(segs, ecl);
        };
        // Returns a QR Code representing the given binary data at the given error correction level.
        // This function always encodes using the binary segment mode, not any text mode. The maximum number of
        // bytes allowed is 2953. The smallest possible QR Code version is automatically chosen for the output.
        // The ECC level of the result may be higher than the ecl argument if it can be done without increasing the version.
        _QrCode.encodeBinary = function (data, ecl) {
            var seg = qrcodegen2.QrSegment.makeBytes(data);
            return _QrCode.encodeSegments([seg], ecl);
        };
        /*-- Static factory functions (mid level) --*/
        // Returns a QR Code representing the given segments with the given encoding parameters.
        // The smallest possible QR Code version within the given range is automatically
        // chosen for the output. Iff boostEcl is true, then the ECC level of the result
        // may be higher than the ecl argument if it can be done without increasing the
        // version. The mask number is either between 0 to 7 (inclusive) to force that
        // mask, or -1 to automatically choose an appropriate mask (which may be slow).
        // This function allows the user to create a custom sequence of segments that switches
        // between modes (such as alphanumeric and byte) to encode text in less space.
        // This is a mid-level API; the high-level API is encodeText() and encodeBinary().
        _QrCode.encodeSegments = function (segs, ecl, minVersion, maxVersion, mask, boostEcl) {
            if (minVersion === void 0) { minVersion = 1; }
            if (maxVersion === void 0) { maxVersion = 40; }
            if (mask === void 0) { mask = -1; }
            if (boostEcl === void 0) { boostEcl = true; }
            if (!(_QrCode.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= _QrCode.MAX_VERSION) || mask < -1 || mask > 7)
                throw new RangeError("Invalid value");
            var version;
            var dataUsedBits;
            for (version = minVersion;; version++) {
                var dataCapacityBits2 = _QrCode.getNumDataCodewords(version, ecl) * 8;
                var usedBits = QrSegment.getTotalBits(segs, version);
                if (usedBits <= dataCapacityBits2) {
                    dataUsedBits = usedBits;
                    break;
                }
                if (version >= maxVersion)
                    throw new RangeError("Data too long");
            }
            for (var _i = 0, _a = [_QrCode.Ecc.MEDIUM, _QrCode.Ecc.QUARTILE, _QrCode.Ecc.HIGH]; _i < _a.length; _i++) {
                var newEcl = _a[_i];
                if (boostEcl && dataUsedBits <= _QrCode.getNumDataCodewords(version, newEcl) * 8)
                    ecl = newEcl;
            }
            var bb = [];
            for (var _b = 0, segs_1 = segs; _b < segs_1.length; _b++) {
                var seg = segs_1[_b];
                appendBits(seg.mode.modeBits, 4, bb);
                appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
                for (var _c = 0, _d = seg.getData(); _c < _d.length; _c++) {
                    var b = _d[_c];
                    bb.push(b);
                }
            }
            assert(bb.length == dataUsedBits);
            var dataCapacityBits = _QrCode.getNumDataCodewords(version, ecl) * 8;
            assert(bb.length <= dataCapacityBits);
            appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
            appendBits(0, (8 - bb.length % 8) % 8, bb);
            assert(bb.length % 8 == 0);
            for (var padByte = 236; bb.length < dataCapacityBits; padByte ^= 236 ^ 17)
                appendBits(padByte, 8, bb);
            var dataCodewords = [];
            while (dataCodewords.length * 8 < bb.length)
                dataCodewords.push(0);
            bb.forEach(function (b, i) { return dataCodewords[i >>> 3] |= b << 7 - (i & 7); });
            return new _QrCode(version, ecl, dataCodewords, mask);
        };
        /*-- Accessor methods --*/
        // Returns the color of the module (pixel) at the given coordinates, which is false
        // for light or true for dark. The top left corner has the coordinates (x=0, y=0).
        // If the given coordinates are out of bounds, then false (light) is returned.
        _QrCode.prototype.getModule = function (x, y) {
            return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
        };
        // Modified to expose modules for easy access
        _QrCode.prototype.getModules = function () {
            return this.modules;
        };
        /*-- Private helper methods for constructor: Drawing function modules --*/
        // Reads this object's version field, and draws and marks all function modules.
        _QrCode.prototype.drawFunctionPatterns = function () {
            for (var i = 0; i < this.size; i++) {
                this.setFunctionModule(6, i, i % 2 == 0);
                this.setFunctionModule(i, 6, i % 2 == 0);
            }
            this.drawFinderPattern(3, 3);
            this.drawFinderPattern(this.size - 4, 3);
            this.drawFinderPattern(3, this.size - 4);
            var alignPatPos = this.getAlignmentPatternPositions();
            var numAlign = alignPatPos.length;
            for (var i = 0; i < numAlign; i++) {
                for (var j = 0; j < numAlign; j++) {
                    if (!(i == 0 && j == 0 || i == 0 && j == numAlign - 1 || i == numAlign - 1 && j == 0))
                        this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
                }
            }
            this.drawFormatBits(0);
            this.drawVersion();
        };
        // Draws two copies of the format bits (with its own error correction code)
        // based on the given mask and this object's error correction level field.
        _QrCode.prototype.drawFormatBits = function (mask) {
            var data = this.errorCorrectionLevel.formatBits << 3 | mask;
            var rem = data;
            for (var i = 0; i < 10; i++)
                rem = rem << 1 ^ (rem >>> 9) * 1335;
            var bits = (data << 10 | rem) ^ 21522;
            assert(bits >>> 15 == 0);
            for (var i = 0; i <= 5; i++)
                this.setFunctionModule(8, i, getBit(bits, i));
            this.setFunctionModule(8, 7, getBit(bits, 6));
            this.setFunctionModule(8, 8, getBit(bits, 7));
            this.setFunctionModule(7, 8, getBit(bits, 8));
            for (var i = 9; i < 15; i++)
                this.setFunctionModule(14 - i, 8, getBit(bits, i));
            for (var i = 0; i < 8; i++)
                this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
            for (var i = 8; i < 15; i++)
                this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
            this.setFunctionModule(8, this.size - 8, true);
        };
        // Draws two copies of the version bits (with its own error correction code),
        // based on this object's version field, iff 7 <= version <= 40.
        _QrCode.prototype.drawVersion = function () {
            if (this.version < 7)
                return;
            var rem = this.version;
            for (var i = 0; i < 12; i++)
                rem = rem << 1 ^ (rem >>> 11) * 7973;
            var bits = this.version << 12 | rem;
            assert(bits >>> 18 == 0);
            for (var i = 0; i < 18; i++) {
                var color = getBit(bits, i);
                var a = this.size - 11 + i % 3;
                var b = Math.floor(i / 3);
                this.setFunctionModule(a, b, color);
                this.setFunctionModule(b, a, color);
            }
        };
        // Draws a 9*9 finder pattern including the border separator,
        // with the center module at (x, y). Modules can be out of bounds.
        _QrCode.prototype.drawFinderPattern = function (x, y) {
            for (var dy = -4; dy <= 4; dy++) {
                for (var dx = -4; dx <= 4; dx++) {
                    var dist = Math.max(Math.abs(dx), Math.abs(dy));
                    var xx = x + dx;
                    var yy = y + dy;
                    if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
                        this.setFunctionModule(xx, yy, dist != 2 && dist != 4);
                }
            }
        };
        // Draws a 5*5 alignment pattern, with the center module
        // at (x, y). All modules must be in bounds.
        _QrCode.prototype.drawAlignmentPattern = function (x, y) {
            for (var dy = -2; dy <= 2; dy++) {
                for (var dx = -2; dx <= 2; dx++)
                    this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
            }
        };
        // Sets the color of a module and marks it as a function module.
        // Only used by the constructor. Coordinates must be in bounds.
        _QrCode.prototype.setFunctionModule = function (x, y, isDark) {
            this.modules[y][x] = isDark;
            this.isFunction[y][x] = true;
        };
        /*-- Private helper methods for constructor: Codewords and masking --*/
        // Returns a new byte string representing the given data with the appropriate error correction
        // codewords appended to it, based on this object's version and error correction level.
        _QrCode.prototype.addEccAndInterleave = function (data) {
            var ver = this.version;
            var ecl = this.errorCorrectionLevel;
            if (data.length != _QrCode.getNumDataCodewords(ver, ecl))
                throw new RangeError("Invalid argument");
            var numBlocks = _QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
            var blockEccLen = _QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
            var rawCodewords = Math.floor(_QrCode.getNumRawDataModules(ver) / 8);
            var numShortBlocks = numBlocks - rawCodewords % numBlocks;
            var shortBlockLen = Math.floor(rawCodewords / numBlocks);
            var blocks = [];
            var rsDiv = _QrCode.reedSolomonComputeDivisor(blockEccLen);
            for (var i = 0, k = 0; i < numBlocks; i++) {
                var dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
                k += dat.length;
                var ecc = _QrCode.reedSolomonComputeRemainder(dat, rsDiv);
                if (i < numShortBlocks)
                    dat.push(0);
                blocks.push(dat.concat(ecc));
            }
            var result = [];
            var _loop_1 = function (i) {
                blocks.forEach(function (block, j) {
                    if (i != shortBlockLen - blockEccLen || j >= numShortBlocks)
                        result.push(block[i]);
                });
            };
            for (var i = 0; i < blocks[0].length; i++) {
                _loop_1(i);
            }
            assert(result.length == rawCodewords);
            return result;
        };
        // Draws the given sequence of 8-bit codewords (data and error correction) onto the entire
        // data area of this QR Code. Function modules need to be marked off before this is called.
        _QrCode.prototype.drawCodewords = function (data) {
            if (data.length != Math.floor(_QrCode.getNumRawDataModules(this.version) / 8))
                throw new RangeError("Invalid argument");
            var i = 0;
            for (var right = this.size - 1; right >= 1; right -= 2) {
                if (right == 6)
                    right = 5;
                for (var vert = 0; vert < this.size; vert++) {
                    for (var j = 0; j < 2; j++) {
                        var x = right - j;
                        var upward = (right + 1 & 2) == 0;
                        var y = upward ? this.size - 1 - vert : vert;
                        if (!this.isFunction[y][x] && i < data.length * 8) {
                            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
                            i++;
                        }
                    }
                }
            }
            assert(i == data.length * 8);
        };
        // XORs the codeword modules in this QR Code with the given mask pattern.
        // The function modules must be marked and the codeword bits must be drawn
        // before masking. Due to the arithmetic of XOR, calling applyMask() with
        // the same mask value a second time will undo the mask. A final well-formed
        // QR Code needs exactly one (not zero, two, etc.) mask applied.
        _QrCode.prototype.applyMask = function (mask) {
            if (mask < 0 || mask > 7)
                throw new RangeError("Mask value out of range");
            for (var y = 0; y < this.size; y++) {
                for (var x = 0; x < this.size; x++) {
                    var invert = void 0;
                    switch (mask) {
                        case 0:
                            invert = (x + y) % 2 == 0;
                            break;
                        case 1:
                            invert = y % 2 == 0;
                            break;
                        case 2:
                            invert = x % 3 == 0;
                            break;
                        case 3:
                            invert = (x + y) % 3 == 0;
                            break;
                        case 4:
                            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0;
                            break;
                        case 5:
                            invert = x * y % 2 + x * y % 3 == 0;
                            break;
                        case 6:
                            invert = (x * y % 2 + x * y % 3) % 2 == 0;
                            break;
                        case 7:
                            invert = ((x + y) % 2 + x * y % 3) % 2 == 0;
                            break;
                        default:
                            throw new Error("Unreachable");
                    }
                    if (!this.isFunction[y][x] && invert)
                        this.modules[y][x] = !this.modules[y][x];
                }
            }
        };
        // Calculates and returns the penalty score based on state of this QR Code's current modules.
        // This is used by the automatic mask choice algorithm to find the mask pattern that yields the lowest score.
        _QrCode.prototype.getPenaltyScore = function () {
            var result = 0;
            for (var y = 0; y < this.size; y++) {
                var runColor = false;
                var runX = 0;
                var runHistory = [0, 0, 0, 0, 0, 0, 0];
                for (var x = 0; x < this.size; x++) {
                    if (this.modules[y][x] == runColor) {
                        runX++;
                        if (runX == 5)
                            result += _QrCode.PENALTY_N1;
                        else if (runX > 5)
                            result++;
                    }
                    else {
                        this.finderPenaltyAddHistory(runX, runHistory);
                        if (!runColor)
                            result += this.finderPenaltyCountPatterns(runHistory) * _QrCode.PENALTY_N3;
                        runColor = this.modules[y][x];
                        runX = 1;
                    }
                }
                result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * _QrCode.PENALTY_N3;
            }
            for (var x = 0; x < this.size; x++) {
                var runColor = false;
                var runY = 0;
                var runHistory = [0, 0, 0, 0, 0, 0, 0];
                for (var y = 0; y < this.size; y++) {
                    if (this.modules[y][x] == runColor) {
                        runY++;
                        if (runY == 5)
                            result += _QrCode.PENALTY_N1;
                        else if (runY > 5)
                            result++;
                    }
                    else {
                        this.finderPenaltyAddHistory(runY, runHistory);
                        if (!runColor)
                            result += this.finderPenaltyCountPatterns(runHistory) * _QrCode.PENALTY_N3;
                        runColor = this.modules[y][x];
                        runY = 1;
                    }
                }
                result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * _QrCode.PENALTY_N3;
            }
            for (var y = 0; y < this.size - 1; y++) {
                for (var x = 0; x < this.size - 1; x++) {
                    var color = this.modules[y][x];
                    if (color == this.modules[y][x + 1] && color == this.modules[y + 1][x] && color == this.modules[y + 1][x + 1])
                        result += _QrCode.PENALTY_N2;
                }
            }
            var dark = 0;
            for (var _i = 0, _a = this.modules; _i < _a.length; _i++) {
                var row = _a[_i];
                dark = row.reduce(function (sum, color) { return sum + (color ? 1 : 0); }, dark);
            }
            var total = this.size * this.size;
            var k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
            assert(0 <= k && k <= 9);
            result += k * _QrCode.PENALTY_N4;
            assert(0 <= result && result <= 2568888);
            return result;
        };
        /*-- Private helper functions --*/
        // Returns an ascending list of positions of alignment patterns for this version number.
        // Each position is in the range [0,177), and are used on both the x and y axes.
        // This could be implemented as lookup table of 40 variable-length lists of integers.
        _QrCode.prototype.getAlignmentPatternPositions = function () {
            if (this.version == 1)
                return [];
            else {
                var numAlign = Math.floor(this.version / 7) + 2;
                var step = this.version == 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
                var result = [6];
                for (var pos = this.size - 7; result.length < numAlign; pos -= step)
                    result.splice(1, 0, pos);
                return result;
            }
        };
        // Returns the number of data bits that can be stored in a QR Code of the given version number, after
        // all function modules are excluded. This includes remainder bits, so it might not be a multiple of 8.
        // The result is in the range [208, 29648]. This could be implemented as a 40-entry lookup table.
        _QrCode.getNumRawDataModules = function (ver) {
            if (ver < _QrCode.MIN_VERSION || ver > _QrCode.MAX_VERSION)
                throw new RangeError("Version number out of range");
            var result = (16 * ver + 128) * ver + 64;
            if (ver >= 2) {
                var numAlign = Math.floor(ver / 7) + 2;
                result -= (25 * numAlign - 10) * numAlign - 55;
                if (ver >= 7)
                    result -= 36;
            }
            assert(208 <= result && result <= 29648);
            return result;
        };
        // Returns the number of 8-bit data (i.e. not error correction) codewords contained in any
        // QR Code of the given version number and error correction level, with remainder bits discarded.
        // This stateless pure function could be implemented as a (40*4)-cell lookup table.
        _QrCode.getNumDataCodewords = function (ver, ecl) {
            return Math.floor(_QrCode.getNumRawDataModules(ver) / 8) - _QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * _QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
        };
        // Returns a Reed-Solomon ECC generator polynomial for the given degree. This could be
        // implemented as a lookup table over all possible parameter values, instead of as an algorithm.
        _QrCode.reedSolomonComputeDivisor = function (degree) {
            if (degree < 1 || degree > 255)
                throw new RangeError("Degree out of range");
            var result = [];
            for (var i = 0; i < degree - 1; i++)
                result.push(0);
            result.push(1);
            var root = 1;
            for (var i = 0; i < degree; i++) {
                for (var j = 0; j < result.length; j++) {
                    result[j] = _QrCode.reedSolomonMultiply(result[j], root);
                    if (j + 1 < result.length)
                        result[j] ^= result[j + 1];
                }
                root = _QrCode.reedSolomonMultiply(root, 2);
            }
            return result;
        };
        // Returns the Reed-Solomon error correction codeword for the given data and divisor polynomials.
        _QrCode.reedSolomonComputeRemainder = function (data, divisor) {
            var result = divisor.map(function (_) { return 0; });
            var _loop_2 = function (b) {
                var factor = b ^ result.shift();
                result.push(0);
                divisor.forEach(function (coef, i) { return result[i] ^= _QrCode.reedSolomonMultiply(coef, factor); });
            };
            for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
                var b = data_1[_i];
                _loop_2(b);
            }
            return result;
        };
        // Returns the product of the two given field elements modulo GF(2^8/0x11D). The arguments and result
        // are unsigned 8-bit integers. This could be implemented as a lookup table of 256*256 entries of uint8.
        _QrCode.reedSolomonMultiply = function (x, y) {
            if (x >>> 8 != 0 || y >>> 8 != 0)
                throw new RangeError("Byte out of range");
            var z = 0;
            for (var i = 7; i >= 0; i--) {
                z = z << 1 ^ (z >>> 7) * 285;
                z ^= (y >>> i & 1) * x;
            }
            assert(z >>> 8 == 0);
            return z;
        };
        // Can only be called immediately after a light run is added, and
        // returns either 0, 1, or 2. A helper function for getPenaltyScore().
        _QrCode.prototype.finderPenaltyCountPatterns = function (runHistory) {
            var n = runHistory[1];
            assert(n <= this.size * 3);
            var core = n > 0 && runHistory[2] == n && runHistory[3] == n * 3 && runHistory[4] == n && runHistory[5] == n;
            return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
        };
        // Must be called at the end of a line (row or column) of modules. A helper function for getPenaltyScore().
        _QrCode.prototype.finderPenaltyTerminateAndCount = function (currentRunColor, currentRunLength, runHistory) {
            if (currentRunColor) {
                this.finderPenaltyAddHistory(currentRunLength, runHistory);
                currentRunLength = 0;
            }
            currentRunLength += this.size;
            this.finderPenaltyAddHistory(currentRunLength, runHistory);
            return this.finderPenaltyCountPatterns(runHistory);
        };
        // Pushes the given value to the front and drops the last value. A helper function for getPenaltyScore().
        _QrCode.prototype.finderPenaltyAddHistory = function (currentRunLength, runHistory) {
            if (runHistory[0] == 0)
                currentRunLength += this.size;
            runHistory.pop();
            runHistory.unshift(currentRunLength);
        };
        return _QrCode;
    }());
    /*-- Constants and tables --*/
    // The minimum version number supported in the QR Code Model 2 standard.
    _QrCode.MIN_VERSION = 1;
    // The maximum version number supported in the QR Code Model 2 standard.
    _QrCode.MAX_VERSION = 40;
    // For use in getPenaltyScore(), when evaluating which mask is best.
    _QrCode.PENALTY_N1 = 3;
    _QrCode.PENALTY_N2 = 3;
    _QrCode.PENALTY_N3 = 40;
    _QrCode.PENALTY_N4 = 10;
    _QrCode.ECC_CODEWORDS_PER_BLOCK = [
        // Version: (note that index 0 is for padding, and is set to an illegal value)
        //0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
        [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        // Low
        [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
        // Medium
        [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        // Quartile
        [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
        // High
    ];
    _QrCode.NUM_ERROR_CORRECTION_BLOCKS = [
        // Version: (note that index 0 is for padding, and is set to an illegal value)
        //0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
        [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
        // Low
        [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
        // Medium
        [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
        // Quartile
        [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
        // High
    ];
    var QrCode = _QrCode;
    qrcodegen2.QrCode = _QrCode;
    function appendBits(val, len, bb) {
        if (len < 0 || len > 31 || val >>> len != 0)
            throw new RangeError("Value out of range");
        for (var i = len - 1; i >= 0; i--)
            bb.push(val >>> i & 1);
    }
    function getBit(x, i) {
        return (x >>> i & 1) != 0;
    }
    function assert(cond) {
        if (!cond)
            throw new Error("Assertion error");
    }
    var _QrSegment = /** @class */ (function () {
        /*-- Constructor (low level) and fields --*/
        // Creates a new QR Code segment with the given attributes and data.
        // The character count (numChars) must agree with the mode and the bit buffer length,
        // but the constraint isn't checked. The given bit buffer is cloned and stored.
        function _QrSegment(mode, numChars, bitData) {
            this.mode = mode;
            this.numChars = numChars;
            this.bitData = bitData;
            if (numChars < 0)
                throw new RangeError("Invalid argument");
            this.bitData = bitData.slice();
        }
        /*-- Static factory functions (mid level) --*/
        // Returns a segment representing the given binary data encoded in
        // byte mode. All input byte arrays are acceptable. Any text string
        // can be converted to UTF-8 bytes and encoded as a byte mode segment.
        _QrSegment.makeBytes = function (data) {
            var bb = [];
            for (var _i = 0, data_2 = data; _i < data_2.length; _i++) {
                var b = data_2[_i];
                appendBits(b, 8, bb);
            }
            return new _QrSegment(_QrSegment.Mode.BYTE, data.length, bb);
        };
        // Returns a segment representing the given string of decimal digits encoded in numeric mode.
        _QrSegment.makeNumeric = function (digits) {
            if (!_QrSegment.isNumeric(digits))
                throw new RangeError("String contains non-numeric characters");
            var bb = [];
            for (var i = 0; i < digits.length;) {
                var n = Math.min(digits.length - i, 3);
                appendBits(parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
                i += n;
            }
            return new _QrSegment(_QrSegment.Mode.NUMERIC, digits.length, bb);
        };
        // Returns a segment representing the given text string encoded in alphanumeric mode.
        // The characters allowed are: 0 to 9, A to Z (uppercase only), space,
        // dollar, percent, asterisk, plus, hyphen, period, slash, colon.
        _QrSegment.makeAlphanumeric = function (text) {
            if (!_QrSegment.isAlphanumeric(text))
                throw new RangeError("String contains unencodable characters in alphanumeric mode");
            var bb = [];
            var i;
            for (i = 0; i + 2 <= text.length; i += 2) {
                var temp = _QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
                temp += _QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
                appendBits(temp, 11, bb);
            }
            if (i < text.length)
                appendBits(_QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
            return new _QrSegment(_QrSegment.Mode.ALPHANUMERIC, text.length, bb);
        };
        // Returns a new mutable list of zero or more segments to represent the given Unicode text string.
        // The result may use various segment modes and switch modes to optimize the length of the bit stream.
        _QrSegment.makeSegments = function (text) {
            if (text == "")
                return [];
            else if (_QrSegment.isNumeric(text))
                return [_QrSegment.makeNumeric(text)];
            else if (_QrSegment.isAlphanumeric(text))
                return [_QrSegment.makeAlphanumeric(text)];
            else
                return [_QrSegment.makeBytes(_QrSegment.toUtf8ByteArray(text))];
        };
        // Returns a segment representing an Extended Channel Interpretation
        // (ECI) designator with the given assignment value.
        _QrSegment.makeEci = function (assignVal) {
            var bb = [];
            if (assignVal < 0)
                throw new RangeError("ECI assignment value out of range");
            else if (assignVal < 1 << 7)
                appendBits(assignVal, 8, bb);
            else if (assignVal < 1 << 14) {
                appendBits(2, 2, bb);
                appendBits(assignVal, 14, bb);
            }
            else if (assignVal < 1e6) {
                appendBits(6, 3, bb);
                appendBits(assignVal, 21, bb);
            }
            else
                throw new RangeError("ECI assignment value out of range");
            return new _QrSegment(_QrSegment.Mode.ECI, 0, bb);
        };
        // Tests whether the given string can be encoded as a segment in numeric mode.
        // A string is encodable iff each character is in the range 0 to 9.
        _QrSegment.isNumeric = function (text) {
            return _QrSegment.NUMERIC_REGEX.test(text);
        };
        // Tests whether the given string can be encoded as a segment in alphanumeric mode.
        // A string is encodable iff each character is in the following set: 0 to 9, A to Z
        // (uppercase only), space, dollar, percent, asterisk, plus, hyphen, period, slash, colon.
        _QrSegment.isAlphanumeric = function (text) {
            return _QrSegment.ALPHANUMERIC_REGEX.test(text);
        };
        /*-- Methods --*/
        // Returns a new copy of the data bits of this segment.
        _QrSegment.prototype.getData = function () {
            return this.bitData.slice();
        };
        // (Package-private) Calculates and returns the number of bits needed to encode the given segments at
        // the given version. The result is infinity if a segment has too many characters to fit its length field.
        _QrSegment.getTotalBits = function (segs, version) {
            var result = 0;
            for (var _i = 0, segs_2 = segs; _i < segs_2.length; _i++) {
                var seg = segs_2[_i];
                var ccbits = seg.mode.numCharCountBits(version);
                if (seg.numChars >= 1 << ccbits)
                    return Infinity;
                result += 4 + ccbits + seg.bitData.length;
            }
            return result;
        };
        // Returns a new array of bytes representing the given string encoded in UTF-8.
        _QrSegment.toUtf8ByteArray = function (str) {
            str = encodeURI(str);
            var result = [];
            for (var i = 0; i < str.length; i++) {
                if (str.charAt(i) != "%")
                    result.push(str.charCodeAt(i));
                else {
                    result.push(parseInt(str.substring(i + 1, i + 3), 16));
                    i += 2;
                }
            }
            return result;
        };
        return _QrSegment;
    }());
    /*-- Constants --*/
    // Describes precisely all strings that are encodable in numeric mode.
    _QrSegment.NUMERIC_REGEX = /^[0-9]*$/;
    // Describes precisely all strings that are encodable in alphanumeric mode.
    _QrSegment.ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+.\/:-]*$/;
    // The set of all legal characters in alphanumeric mode,
    // where each character value maps to the index in the string.
    _QrSegment.ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
    var QrSegment = _QrSegment;
    qrcodegen2.QrSegment = _QrSegment;
})(qrcodegen || (qrcodegen = {}));
(function (qrcodegen2) {
    var QrCode;
    (function (QrCode2) {
        var _Ecc = /** @class */ (function () {
            // The QR Code can tolerate about 30% erroneous codewords
            /*-- Constructor and fields --*/
            function _Ecc(ordinal, formatBits) {
                this.ordinal = ordinal;
                this.formatBits = formatBits;
            }
            return _Ecc;
        }());
        /*-- Constants --*/
        _Ecc.LOW = new _Ecc(0, 1);
        // The QR Code can tolerate about  7% erroneous codewords
        _Ecc.MEDIUM = new _Ecc(1, 0);
        // The QR Code can tolerate about 15% erroneous codewords
        _Ecc.QUARTILE = new _Ecc(2, 3);
        // The QR Code can tolerate about 25% erroneous codewords
        _Ecc.HIGH = new _Ecc(3, 2);
        var Ecc = _Ecc;
        QrCode2.Ecc = _Ecc;
    })(QrCode = qrcodegen2.QrCode || (qrcodegen2.QrCode = {}));
})(qrcodegen || (qrcodegen = {}));
(function (qrcodegen2) {
    var QrSegment;
    (function (QrSegment2) {
        var _Mode = /** @class */ (function () {
            /*-- Constructor and fields --*/
            function _Mode(modeBits, numBitsCharCount) {
                this.modeBits = modeBits;
                this.numBitsCharCount = numBitsCharCount;
            }
            /*-- Method --*/
            // (Package-private) Returns the bit width of the character count field for a segment in
            // this mode in a QR Code at the given version number. The result is in the range [0, 16].
            _Mode.prototype.numCharCountBits = function (ver) {
                return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
            };
            return _Mode;
        }());
        /*-- Constants --*/
        _Mode.NUMERIC = new _Mode(1, [10, 12, 14]);
        _Mode.ALPHANUMERIC = new _Mode(2, [9, 11, 13]);
        _Mode.BYTE = new _Mode(4, [8, 16, 16]);
        _Mode.KANJI = new _Mode(8, [8, 10, 12]);
        _Mode.ECI = new _Mode(7, [0, 0, 0]);
        var Mode = _Mode;
        QrSegment2.Mode = _Mode;
    })(QrSegment = qrcodegen2.QrSegment || (qrcodegen2.QrSegment = {}));
})(qrcodegen || (qrcodegen = {}));

	return qrcodegen;
});
