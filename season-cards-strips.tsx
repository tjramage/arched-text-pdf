import { css, Document, Flow, Layout, PageBreak, type RenderProps } from '@format.dev/react'

// This document prints one season-card mailer per member. The member's name
// is set in an arched ribbon and always spans the same width, however long
// the name is. The name stays text in the PDF, and the whole file uses one
// font.
//
// PDF can scale, skew and rotate text but cannot bend it, so the arch is built
// from vertical strips. Every strip shows the whole name, clipped to its own
// column and sheared so the baseline follows the arch across that column. The
// shears meet at the strip edges, so the bent outline has no steps in it.

export interface CardData {
	/** How many cards to produce, one page each. */
	count: number
	/** How many strips each arch is cut into. More strips follow the curve more closely. */
	strips: number
}

const defaults: CardData = { count: 250, strips: 32 }

// Sixteen given names and sixteen family names make 256 different members.
// The names average 14 characters and run from "Li Wu" to
// "Bartholomew Featherstonehaugh".
const GIVEN = [
	...['Alexandria', 'Daniel', 'María-José', 'Jo', 'Bartholomew', 'Zoë', 'Christopher', 'Li'],
	...['Oluwaseun', 'Siobhán', 'Emma', 'Ng', 'Priya', 'Tomasz', 'Grace', 'Mohammed']
]
const FAMILY = [
	...['Ortiz', 'Nakamura', 'Wu', 'Okonkwo-Hughes', 'Featherstonehaugh', 'Kim', 'van der Berg', 'Ó Briain'],
	...['Smith', 'Patel', 'Jones', 'García', 'Müller', 'Rossi', 'Novak', 'Campbell']
]
const STREETS = ['Harbour Road', 'Mill Lane', 'Orchard Close', 'Station Parade', 'Castle Street', 'Quarry Hill']
const TOWNS = ['Whitby', 'Ludlow', 'Totnes', 'Hexham', 'Frome', 'Alnwick', 'Kendal']

interface Member {
	given: string
	name: string
	/** The name as the ribbon prints it. */
	lettering: string
	number: string
	seasons: number
	seat: string
	street: string
	town: string
}

/** Makes up the same members for the same count on every run. */
function members(count: number): Member[] {
	return Array.from({ length: count }, (_, index) => {
		const given = GIVEN[index % GIVEN.length]
		// each pass through the given names starts one family name further on,
		// so no pair repeats until both lists are used up
		const family = FAMILY[(Math.floor(index / GIVEN.length) + index * 3) % FAMILY.length]
		const name = `${given} ${family}`
		return {
			given,
			name,
			lettering: name.toUpperCase(),
			number: String(104217 + index * 37).padStart(7, '0'),
			seasons: 1 + ((index * 11 + 11) % 29),
			seat: `Block ${'ABCDEFGH'[(index * 3) % 8]}, row ${1 + ((index * 7) % 30)}, seat ${1 + ((index * 13) % 24)}`,
			street: `${12 + ((index * 29) % 180)} ${STREETS[(index * 5) % STREETS.length]}`,
			town: TOWNS[(index * 3) % TOWNS.length]
		}
	})
}

const styles = css`
	:host {
		--color-pitch: #0f3a2d;
		--color-cream: #f6eedb;
		--color-gold: #f0b63a;
		--color-rule: #2e5c4b;
		--color-quiet: #a9c2b6;

		background: var(--color-pitch);
		color: var(--color-cream);
		font:
			800 11.5px/17px 'Format Sans',
			sans-serif;
	}

	p,
	dl,
	dd {
		margin: 0;
	}

	.club,
	.imprint {
		position: absolute;
		inset-inline: 40px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.club {
		top: 28px;
		font-size: 13px;
	}

	.club > span:first-child {
		display: flex;
		align-items: center;
		gap: 9px;
	}

	.mark {
		width: 12px;
		height: 12px;
		border: 3px solid var(--color-gold);
		border-radius: 50%;
		box-sizing: border-box;
	}

	.imprint {
		bottom: 22px;
		padding-top: 10px;
		border-top: 1px solid var(--color-rule);
		color: var(--color-quiet);
		font-size: 10px;
		line-height: 14px;
	}

	.cards {
		position: absolute;
		inset: 40px 40px 56px;
	}

	.card {
		position: relative;
		height: 480px;
	}

	/* The name's own coordinate space is 1000 units wide, and the arch spans
	   all of it. The lettering is fitted to the 900 units between the
	   ribbon's notches. */
	.name {
		position: absolute;
		top: 26px;
		left: 0;
		width: 784px;
		overflow: visible;
		fill: var(--color-pitch);
		font:
			800 132px 'Format Sans',
			sans-serif;

		/* the arch rises by this share of the width at its middle */
		--bend: 0.12;
	}

	.ribbon {
		fill: var(--color-cream);
	}

	.piping {
		fill: none;
		stroke: var(--color-gold);
		stroke-width: 4;
	}

	.name use {
		--strips: sibling-count();
		--from: calc((sibling-index() - 1) / var(--strips));
		--to: calc(sibling-index() / var(--strips));

		/* At a fraction t of the way across, the arch has risen by
		   4 × bend × t × (1 − t) of the width. A strip follows the straight
		   line between the arch's heights at the strip's two edges, which is
		   where its neighbours start and stop too. */
		--rise: calc(4 * var(--bend) * var(--from) * (1 - var(--from)));
		--slope: calc(4 * var(--bend) * (1 - var(--from) - var(--to)));

		/* each strip overlaps the next by 0.1% of the width, which keeps a
		   hairline gap from showing between them */
		clip-path: inset(-100% calc((1 - var(--to)) * 100% - 0.1%) -100% calc(var(--from) * 100%)) view-box;
		transform: matrix(1, calc(-1 * var(--slope)), 0, 1, 0, calc(1000 * (var(--slope) * var(--from) - var(--rise))));
	}

	.seasons {
		position: absolute;
		top: 196px;
		inset-inline: 240px;
		text-align: center;
	}

	.count {
		display: block;
		color: var(--color-gold);
		font-size: 190px;
		line-height: 1;
	}

	.seasons span:last-child {
		display: block;
		margin-top: -12px;
		font-size: 13px;
	}

	.letter,
	.details {
		position: absolute;
		top: 312px;
		width: 240px;
	}

	.letter {
		left: 0;
	}

	.details {
		right: 0;
	}

	.lead {
		margin-bottom: 8px;
		color: var(--color-gold);
		font-size: 17px;
		line-height: 22px;
	}

	.letter p:nth-child(2) {
		text-wrap: pretty;
	}

	.letter p:last-child {
		margin-top: 8px;
	}

	.details dl div {
		display: grid;
		grid-template-columns: 62px 1fr;
		padding-block: 5px;
		border-top: 1px solid var(--color-rule);
	}

	.details dt {
		color: var(--color-gold);
	}
`

// The ribbon's long edges are the arch itself, moved down the page, so the
// lettering keeps the same distance from them along its whole length.
const RIBBON = 'M0 138Q500-102 1000 138L978 226L1000 314Q500 74 0 314L22 226Z'
const PIPING = 'M0 126Q500-114 1000 126M0 326Q500 86 1000 326'

function Name({ id, member, strips }: { id: string; member: Member; strips: number }) {
	return (
		<svg className='name' viewBox='0 0 1000 334' role='img' aria-label={member.name}>
			<path className='ribbon' d={RIBBON} />
			<path className='piping' d={PIPING} />
			<defs>
				<text id={id} x='50' y='278' textLength='900' lengthAdjust='spacingAndGlyphs'>
					{member.lettering}
				</text>
			</defs>
			<g>
				{Array.from({ length: strips }, (_, index) => (
					<use key={index} href={`#${id}`} />
				))}
			</g>
		</svg>
	)
}

export default function SeasonCards({ data: given }: RenderProps<Partial<CardData>>) {
	const data = { ...defaults, ...given }

	return (
		<Document title='Halden Athletic season cards' lang='en'>
			<Layout id='card' width={864} height={576}>
				<style>{styles}</style>
				<div className='club'>
					<span>
						<span className='mark' />
						Halden Athletic
					</span>
					<span>Season card 2027–28</span>
				</div>
				<div className='cards'>
					<Flow>
						{members(data.count).flatMap((member, index) => [
							<section className='card' key={member.number}>
								<Name id={`name-${index}`} member={member} strips={data.strips} />
								<p className='seasons'>
									<span className='count'>{member.seasons}</span>
									<span>{member.seasons === 1 ? 'season with us' : 'seasons with us'}</span>
								</p>
								<div className='letter'>
									<p className='lead'>Dear {member.given},</p>
									<p>
										Your seat is saved for 2027–28 and your season card is enclosed. Bring it to the first home game and
										have it stamped at the gate.
									</p>
									<p>See you at Marsh Lane.</p>
								</div>
								<div className='details'>
									<p className='lead'>Your seat</p>
									<dl>
										<div>
											<dt>Seat</dt>
											<dd>{member.seat}</dd>
										</div>
										<div>
											<dt>Member</dt>
											<dd>{member.number}</dd>
										</div>
										<div>
											<dt>Posted to</dt>
											<dd>
												{member.name}
												<br />
												{member.street}
												<br />
												{member.town}
											</dd>
										</div>
									</dl>
								</div>
							</section>,
							<PageBreak key={`break-${member.number}`} />
						])}
					</Flow>
				</div>
				<div className='imprint'>
					<span>Halden Athletic Supporters Trust, PO Box 44, Halden</span>
					<span>First home game: Saturday 14 August</span>
				</div>
			</Layout>
		</Document>
	)
}
