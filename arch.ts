import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import * as fontkit from 'fontkit'

// The arch moves every point of a name up, by an amount that follows a
// parabola across the name's width. For a single letter, that movement is a
// shift, a skew and a bend:
//
//   shift   the letter moves up to the arch's height at the letter's middle
//   skew    the letter slants to the arch's slope at its middle
//   bend    the letter's outline curves, because the arch goes on curving
//           across the letter's width
//
// A matrix can shift and skew a shape, so every letter is placed with a
// matrix. A matrix cannot bend a shape, so the bend is drawn into the
// letter's outline.
//
// The bend depends only on how far the name is stretched to fit, and not on
// where the letter sits. So one bent "A" serves every "A" in every name that
// is stretched about as much. Format stores each distinct outline once in the
// PDF and repeats it by reference, which is what keeps the file small.

/** Describes one letter of a name, ready to draw as an SVG path. */
export interface ArchedLetter {
	/** The bent outline, in thousandths of an em. Letters that bend alike share the same string. */
	outline: string
	/** The matrix that stretches, skews and places the outline on the arch. */
	transform: string
}

// the name is drawn in a picture 1000 units wide, and the arch spans all of
// that width and rises 120 units at the middle
const PICTURE_WIDTH = 1000
const ARCH_RISE = 120

// the lettering is fitted to the 900 units between the ribbon's notches
const LETTERING_LEFT = 50
const LETTERING_WIDTH = 900
const BASELINE = 278
const FONT_SIZE = 132

// on the card the picture is 784 CSS pixels wide, so one unit prints at 0.207 mm
const MM_PER_UNIT = (784 / PICTURE_WIDTH) * (25.4 / 96)

// the arch is the parabola that leaves both ends of the picture where they
// are and moves the middle up by `ARCH_RISE`
const CURVATURE = (4 * ARCH_RISE) / PICTURE_WIDTH ** 2
const SLOPE_AT_LEFT = -(4 * ARCH_RISE) / PICTURE_WIDTH

/** Returns how far the arch moves a point at `x`. The result is zero at both ends and negative in between, because the y axis of an SVG points down. */
const liftAt = (x: number) => CURVATURE * x * x + SLOPE_AT_LEFT * x

/** Returns the slope of the arch at `x`. */
const slopeAt = (x: number) => 2 * CURVATURE * x + SLOPE_AT_LEFT

// A letter's bend is rounded to a step, so that letters which bend almost
// alike can share one outline. The rounding never moves the edge of a letter
// by more than this distance.
const BEND_TOLERANCE_MM = 0.02

// A curved edge of a glyph is redrawn as cubic curves. Each cubic stays
// within this distance of the true bent edge.
const CURVE_TOLERANCE_MM = 0.001

/** Converts a printed distance to ems of the lettering, which is the unit that outlines are bent in. */
const inEm = (millimetres: number) => millimetres / (MM_PER_UNIT * FONT_SIZE)

type Point = [x: number, y: number]

interface Glyph {
	id: number
	bbox: { minX: number; maxX: number }
	path: { commands: Array<{ command: string; args: number[] }> }
}

interface GlyphPosition {
	xAdvance: number
	xOffset: number
	yOffset: number
}

// the outlines come from the Format Sans file that Format itself embeds
const fontsPackage = dirname(createRequire(import.meta.url).resolve('@format.dev/fonts/manifest.json'))
const font = fontkit.openSync(join(fontsPackage, 'fonts/static/sans/FormatSans-800.ttf'))
const UNITS_PER_EM: number = font.unitsPerEm

const rounded = (value: number, places: number) => String(Number(value.toFixed(places)))

const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

/**
 * Draws a glyph with its outline bent, as SVG path data in thousandths of an em.
 *
 * Every point moves down by `bend` times the square of its distance from
 * `centre`, so the middle of the glyph stays where it is and both sides move
 * down.
 */
function bentOutline(glyph: Glyph, centre: number, bend: number): string {
	const segments: string[] = []

	const bent = ([x, y]: Point): Point => [x, y + bend * (x - centre) ** 2]

	const draw = (operator: string, ...points: Point[]) => {
		const numbers = points.flat().map(value => rounded(value * 1000, 2))
		segments.push(operator + numbers.join(' '))
	}

	// A straight edge becomes exactly one quadratic curve under this bend. A
	// vertical edge stays straight, because all of it moves down by the same
	// amount.
	function line(start: Point, end: Point) {
		if (bend === 0 || start[0] === end[0]) {
			draw('L', bent(end))
			return
		}

		const [x, y] = bent(midpoint(start, end))
		draw('Q', [x, 2 * y - (bent(start)[1] + bent(end)[1]) / 2], bent(end))
	}

	// returns the control point that makes a cubic leave `point` in the
	// direction the bent curve leaves it
	function tangentHandle(point: Point, towards: Point): Point {
		const [x, y] = bent(point)
		const run = towards[0] - point[0]
		const rise = towards[1] - point[1]
		return [x + (2 * run) / 3, y + (2 * (rise + 2 * bend * (x - centre) * run)) / 3]
	}

	// Bending a curved edge gives a curve that SVG has no command for, so the
	// edge is redrawn as a cubic that starts and ends in the same directions.
	// Where the cubic would be further from the true edge than the tolerance,
	// the edge is cut in half and each half is redrawn.
	function curve(start: Point, handle: Point, end: Point) {
		const widestGap = (bend * (start[0] - 2 * handle[0] + end[0]) ** 2) / 16

		if (widestGap > inEm(CURVE_TOLERANCE_MM)) {
			const first = midpoint(start, handle)
			const second = midpoint(handle, end)
			const middle = midpoint(first, second)
			curve(start, first, middle)
			curve(middle, second, end)
			return
		}

		draw('C', tangentHandle(start, handle), tangentHandle(end, handle), bent(end))
	}

	let contourStart: Point = [0, 0]
	let current: Point = contourStart

	for (const { command, args } of glyph.path.commands) {
		// font coordinates run upwards and SVG runs downwards, so y is flipped
		const end: Point = [args.at(-2)! / UNITS_PER_EM, -args.at(-1)! / UNITS_PER_EM]

		switch (command) {
			case 'moveTo':
				contourStart = end
				draw('M', bent(end))
				break

			case 'lineTo':
				line(current, end)
				break

			case 'quadraticCurveTo':
				curve(current, [args[0] / UNITS_PER_EM, -args[1] / UNITS_PER_EM], end)
				break

			case 'closePath':
				if (current[0] !== contourStart[0] || current[1] !== contourStart[1]) line(current, contourStart)
				draw('Z')
				current = contourStart
				continue

			default:
				throw new Error(`Expected a TrueType outline, but found a ${command} segment`)
		}

		current = end
	}

	return segments.join('')
}

// Every outline is kept once it has been drawn, under its glyph and its bend.
// A second request returns the very same string, so the document draws the
// very same path and Format stores it once.
const outlines = new Map<string, string>()

/**
 * Lays a name out on the arch, one letter at a time.
 *
 * The name is stretched sideways to fit the lettering's width, so a short
 * name's letters are drawn wide and a long name's letters are drawn narrow.
 */
export function archedLetters(name: string): ArchedLetter[] {
	const run = font.layout(name)
	const glyphs: Glyph[] = run.glyphs
	const positions: GlyphPosition[] = run.positions

	// how wide one em of this name is drawn, after the stretch
	const emWidth = (LETTERING_WIDTH * UNITS_PER_EM) / run.advanceWidth

	// how sharply every letter of this name has to bend
	const neededBend = (CURVATURE * emWidth ** 2) / FONT_SIZE

	const letters: ArchedLetter[] = []
	let pen = 0

	glyphs.forEach((glyph, index) => {
		const position = positions[index]
		const left = LETTERING_LEFT + (emWidth * (pen + position.xOffset)) / UNITS_PER_EM
		pen += position.xAdvance

		// a space has an advance but nothing to draw
		if (glyph.path.commands.length === 0) return

		// The glyph bends about the middle of its ink. Its reach is how far
		// the ink extends from that middle to either side.
		const centre = (glyph.bbox.minX + glyph.bbox.maxX) / (2 * UNITS_PER_EM)
		const reach = (glyph.bbox.maxX - glyph.bbox.minX) / (2 * UNITS_PER_EM)

		// a wide glyph shows a small change in bend more than a narrow one
		// does, so its steps are finer
		const step = (4 * inEm(BEND_TOLERANCE_MM)) / reach ** 2
		const rung = Math.round(neededBend / step)
		const bend = rung * step

		const key = `${glyph.id}:${rung}`
		let outline = outlines.get(key)
		if (outline === undefined) {
			outline = bentOutline(glyph, centre, bend)
			outlines.set(key, outline)
		}

		// The rounded bend is a little weaker or stronger than the name needs.
		// Moving the letter by half of the difference at its edge splits the
		// error evenly above and below the true curve.
		const leftover = (FONT_SIZE * (neededBend - bend) * reach ** 2) / 2

		const middle = left + centre * emWidth
		const slope = slopeAt(middle)
		const top =
			BASELINE + liftAt(middle) - slope * centre * emWidth + leftover - (FONT_SIZE * position.yOffset) / UNITS_PER_EM

		const matrix = [emWidth / 1000, (slope * emWidth) / 1000, 0, FONT_SIZE / 1000, left, top]

		letters.push({
			outline,
			transform: `matrix(${matrix.map(value => rounded(value, 7)).join(' ')})`
		})
	})

	return letters
}
