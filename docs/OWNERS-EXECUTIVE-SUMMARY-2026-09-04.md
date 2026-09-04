# Beyond RV website: what it is and what it does

For the owners of Beyond RV · 4 September 2026 · beyondrv.com.au

---

## In one paragraph

You have a working online business, not a brochure. The site sells product and
takes payment, answers the question customers actually ask before buying a
slide-on camper, and runs the daily work of the business behind a login. The
part that is genuinely unusual is the vehicle data: 165 Australian ute and truck
variants, every published figure traceable to a manufacturer document, and where
a figure flatters the vehicle the customer is told so on the page.

---

## What a customer can do

**Find out whether a camper suits their vehicle.** They choose their ute from a
list of 165 variants across 14 makes. The calculator fills in the GVM and kerb
weight from the manufacturer's own specification, then works out available
payload, loaded weight and how much margin is left. It names the camper model
their tray suits.

**Understand the answer.** Every figure carries its source. Where the stored kerb
mass is the manufacturer's lightest-equipment figure, the page says so, because
that figure makes the payload look better than the vehicle will deliver. Thirty
of the 165 variants carry that disclosure.

**Be told what they need, not just what they lack.** A slide-on mounts on a flat
tray. Ninety-six of the 165 vehicles leave the factory without one, and those
customers are told a tray would need fitting rather than that their vehicle is a
few hundred millimetres short. That turns a dead end into a conversation.

**Check a caravan tow.** A second calculator covers GVM, GCM, tow capacity, ATM,
GTM and tow ball limits.

**Buy.** A shop with cart, Stripe checkout, shipping quotes and order handling.

**Ask.** The enquiry form arrives pre-filled with what they already entered:
their vehicle, tray length and tray type carry across, so they are not asked
twice, and you receive it as structured information rather than a paragraph.

**Get answered out of hours.** A site chat trained on your product knowledge.

Also: 14 live products across caravans, expedition vehicles and slide-ons; a 3D
configurator; site search; and buying guides on ute suitability and on GVM, GCM,
ATM and GTM.

---

## What the business can do

Behind a login, with the owner and the GM seeing different things:

- **Enquiries and leads** — captured, classified, chased with reminders, and
  summarised daily
- **Sales workspace** — outcomes recorded on a phone, including by voice, with
  retries that cannot double-record an action
- **Contracts and agreements** — drafted, revised, sent, accepted and amended
- **Orders and shipping** — order handling and label generation
- **Product management** — edit, archive, restore and reorder product pages
  without a developer
- **Vehicle review** — publish new vehicles to the calculator from a screen
- **Marketing ideas and a weekly report** — generated from your own data
- **Google integration** — Gmail and Drive, so email and documents attach to the
  right customer
- **Owner copilot** — an assistant over your own records, with an audit log of
  what it did

There are 116 server functions behind this. Fifty-nine of them are admin.

---

## How this compares to the market

A caution first: this is a judgement based on the category, not a formal audit of
named competitors. I have read your code thoroughly and have not tested rivals'
sites.

**The typical Australian caravan or camper manufacturer site** is a brochure with
a gallery, a specification table and a contact form. Some add a dealer locator or
a finance calculator. The customer works out compatibility themselves, or asks.

**Where this site is clearly ahead:**

*Vehicle matching from sourced data.* Most competitors ask a customer to read
their own compliance plate and guess. This site holds 159 ute variants and 33
truck chassis, researched from manufacturer specifications, and does the
arithmetic for them.

*Disclosure as a feature.* The site tells customers when a figure flatters the
vehicle. That is rare because it is uncomfortable, and it is the strongest trust
signal on the page. It also protects you: nobody can say they were told a payload
that the manufacturer never stood behind.

*The business runs inside the website.* Most operators of your size run the site
in one place and the business in a spreadsheet, an inbox and a CRM. Here the
enquiry, the lead, the contract, the order and the shipping label are one system.

*Commerce plus configuration.* A working shop and a 3D configurator on the same
site is not common at this scale.

**Where you are level or behind:**

*Visual polish and photography.* Larger brands out-spend you on imagery and
video, and that is a budget question rather than a code one.

*Reviews and social proof.* Little on the site. Competitors often lead with
customer stories.

*Finance and insurance.* No calculator or partner integration, which several
competitors do have.

*Dealer or inventory listings.* Not applicable to a build-to-order maker, but
worth knowing that browsing customers expect stock lists.

**The honest summary:** you are ahead on substance and behind on presentation.
The site answers the hard question better than anyone in the category is likely
to, and looks less expensive than the big brands while doing it.

---

## What it costs to run

Netlify hosting and functions, Stripe fees on sales, OpenAI usage for chat and
admin assistance, PostHog analytics. All usage-based and modest at current
volumes.

---

## What is not finished

None of this stops the site working. Each is a document or a decision away.

1. **Six truck families** — Fuso Canter, IVECO T-Way, MAN TGS, Mercedes Arocs,
   Scania XT, Volvo FMX. Each needs a manufacturer specification sheet supplied
   by hand, because those websites block automated access. Only the Canter is
   close to camper territory.
2. **Nine vehicles recorded but not published** — three lack a chassis weight,
   six lack a model year the manufacturer never printed. Publishing those six is
   your call, not a research task.
3. **Ford's heavier-equipment weights** — thirty variants carry the optimistic
   disclosure. One brochure page would let twenty-three of them state a
   conservative figure instead.
4. **Tray dimensions** — the biggest opportunity. Ninety-six vehicles need a tray
   fitted, and tray makers such as Norweld and MITS Alloy publish standard sizes
   per vehicle. The database table and loader are built and empty. Filling it
   would let the site tell a tub owner which tray and which camper, instead of
   only that a tray is needed.
5. **The vehicle review screen has never been used.** It works. Eighteen vehicles
   are waiting in it.

---

## What to protect

Two habits keep this site trustworthy, and both are easy to lose.

**Every figure has a source.** The build refuses to publish a vehicle from an
unapproved manufacturer source, and refuses to publish a payload that does not
add up. Do not remove those checks to get something live quickly.

**The site says when it is unsure.** Optimistic weights, corrected figures and
manually published vehicles are all disclosed. Removing that would make the site
look more confident and make it worth less.
