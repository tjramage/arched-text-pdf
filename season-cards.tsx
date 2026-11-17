import { css, Document, Flow, Layout, PageBreak, type RenderProps } from '@format.dev/react'
import { archedLetters } from './arch'

// This document prints one season-card mailer per member. The member's name
// is set in an arched ribbon and always spans the same width, however long
// the name is.
//
// PDF cannot bend text, and drawing every name as its own outline makes a
// large file. So each name is drawn one letter at a time, and every letter is
// an outline that many cards share. The helper in `arch.ts` bends the letters
// and works out where each one goes.
//
// The arched letters are artwork, so each card also carries the name as
// ordinary text, hidden under the ribbon. That copy is what a PDF viewer
// finds, selects and copies.

export interface CardData {
	/** How many cards to produce, one page each. */
	count: number
}

const defaults: CardData = { count: 250 }

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

	.name {
		position: absolute;
		top: 26px;
		left: 0;
		width: 784px;
	}

	/* The picture's own coordinate space is 1000 wide, and the arch spans all
	   of it. The picture is positioned so that it paints over the text that
	   comes before it. */
	.name svg {
		position: relative;
		display: block;
		width: 100%;
		overflow: visible;
		fill: var(--color-pitch);
	}

	/* The text is the ribbon's colour, and the ribbon paints over it. Because
	   the ribbon is arched, only one horizontal band is covered by it from
	   end to end, so the text is placed inside that band. */
	.name-text {
		position: absolute;
		top: 112px;
		inset-inline: 0;
		color: var(--color-cream);
		font-size: 30px;
		line-height: 36px;
		text-align: center;
	}

	.ribbon {
		fill: var(--color-cream);
	}

	.piping {
		fill: none;
		stroke: var(--color-gold);
		stroke-width: 4;
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

function Name({ member }: { member: Member }) {
	return (
		<div className='name'>
			<p className='name-text'>{member.name}</p>

			{/* the picture is marked as decoration, because the paragraph above already carries the name */}
			<svg viewBox='0 0 1000 334' aria-hidden='true'>
				<path className='ribbon' d={RIBBON} />
				<path className='piping' d={PIPING} />

				{archedLetters(member.lettering).map((letter, index) => (
					<path key={index} d={letter.outline} transform={letter.transform} />
				))}
			</svg>
		</div>
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
						{members(data.count).flatMap(member => [
							<section className='card' key={member.number}>
								<Name member={member} />

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
