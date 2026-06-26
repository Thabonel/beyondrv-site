import React, { useState } from 'react';

interface Props {
  basePrice: string;
  productSlug: string;
  productName: string;
}

const EXTRAS = [
  {
    category: 'Power & Electrical',
    items: [
      { id: 'battery',  label: 'Extra 200Ah battery',                        price: 1500 },
      { id: 'inverter', label: 'Upgrade to 3000W Redarc inverter',           price: 3500 },
      { id: 'solar',    label: 'Additional 200W solar panel',                price: 500  },
    ],
  },
  {
    category: 'Heating & Cooling',
    items: [
      { id: 'heater-aufocus', label: '2kW AuFocus diesel heater supply and install',                    price: 2000 },
      { id: 'heater-truma',   label: 'Upgrade to Truma Combi D6 diesel air and water heater',          price: 3500 },
    ],
  },
  {
    category: 'Connectivity',
    items: [
      { id: 'starlink', label: 'Starlink Mini supply and install', price: 1500 },
    ],
  },
  {
    category: 'Water Systems',
    items: [
      { id: 'greywater', label: '40L greywater tank with 12V sump pump', price: 1000 },
    ],
  },
  {
    category: 'Exterior Finish',
    items: [
      { id: 'gelcoat-colour', label: 'Custom gel-coat colour matching', price: 3000 },
    ],
  },
  {
    category: 'Vehicle Connection',
    items: [
      { id: 'anderson', label: 'Anderson Plug supply and install to vehicle', price: 300 },
    ],
  },
];

function formatPrice(n: number) {
  return '$' + n.toLocaleString('en-AU');
}

export default function OptionalExtras({ basePrice, productSlug, productName }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const basePriceNum = parseInt(basePrice.replace(/[^0-9]/g, ''), 10) || null;
  const extrasTotal = EXTRAS.flatMap(c => c.items)
    .filter(i => selected.has(i.id))
    .reduce((sum, i) => sum + i.price, 0);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function buildEnquiryUrl() {
    const selectedItems = EXTRAS.flatMap(c =>
      c.items.filter(i => selected.has(i.id)).map(i => `${i.label} (${formatPrice(i.price)})`)
    );
    const extrasStr = selectedItems.length
      ? `Selected extras for ${productName}:\n${selectedItems.join('\n')}\n\nExtras total: ${formatPrice(extrasTotal)}`
      : `Enquiry about ${productName}`;
    return `/inquiry-form/?product=${encodeURIComponent(productSlug)}&name=${encodeURIComponent(productName)}&message=${encodeURIComponent(extrasStr)}`;
  }

  return (
    <section className="extras-section container">
      <h2 className="section-title">Configure Your Build</h2>
      <p className="extras-subtitle">Select optional extras below — prices are added to your base configuration.</p>

      <div className="extras-grid">
        {EXTRAS.map(cat => (
          <div key={cat.category} className="extras-category">
            <h3 className="extras-category-title">{cat.category}</h3>
            {cat.items.map(item => (
              <label key={item.id} className="extras-item">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="extras-checkbox"
                />
                <span className="extras-item-label">{item.label}</span>
                <span className="extras-item-price">{formatPrice(item.price)}</span>
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="extras-total-bar">
        {basePriceNum ? (
          <div className="extras-total-breakdown">
            <span>Base price: <strong>{formatPrice(basePriceNum)}</strong></span>
            <span className="extras-plus">+</span>
            <span>Extras: <strong>{formatPrice(extrasTotal)}</strong></span>
            <span className="extras-plus">=</span>
            <span className="extras-grand-total">Total: <strong>{formatPrice(basePriceNum + extrasTotal)}</strong></span>
          </div>
        ) : (
          <div className="extras-total-breakdown">
            <span>Base price: <strong>POA</strong></span>
            {extrasTotal > 0 && (
              <>
                <span className="extras-plus">+</span>
                <span>Extras: <strong>{formatPrice(extrasTotal)}</strong></span>
              </>
            )}
          </div>
        )}
        <a href={buildEnquiryUrl()} className="btn-primary extras-enquire-btn">
          Enquire with this configuration
        </a>
      </div>
    </section>
  );
}
