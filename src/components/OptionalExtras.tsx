import React, { useEffect, useState } from 'react';
import { OPTIONAL_EXTRA_CATEGORIES } from '../data/optional-extras';

interface Props {
  basePrice: string;
  productSlug: string;
  productName: string;
}

function formatPrice(n: number) {
  return '$' + n.toLocaleString('en-AU');
}

export default function OptionalExtras({ basePrice, productSlug, productName }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const basePriceNum = parseInt(basePrice.replace(/[^0-9]/g, ''), 10) || null;
  const selectedExtraIds = OPTIONAL_EXTRA_CATEGORIES.flatMap(c => c.items)
    .filter(i => selected.has(i.id))
    .map(i => i.id);
  const extrasTotal = OPTIONAL_EXTRA_CATEGORIES.flatMap(c => c.items)
    .filter(i => selected.has(i.id))
    .reduce((sum, i) => sum + i.price, 0);
  const configuredTotal = basePriceNum ? basePriceNum + extrasTotal : null;

  useEffect(() => {
    const detail = {
      productSlug,
      selectedExtraIds,
      extrasTotal,
      configuredTotal,
    };
    const checkoutRoot = document.querySelector<HTMLElement>('[data-stripe-product]');
    if (checkoutRoot) {
      checkoutRoot.dataset.selectedExtraIds = selectedExtraIds.join(',');
      checkoutRoot.dataset.extrasTotal = String(extrasTotal);
      checkoutRoot.dataset.configuredTotal = configuredTotal ? String(configuredTotal) : '';
    }
    window.dispatchEvent(new CustomEvent('byondrv:extras-change', { detail }));
  }, [productSlug, selectedExtraIds.join(','), extrasTotal, configuredTotal]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function buildEnquiryUrl() {
    const selectedItems = OPTIONAL_EXTRA_CATEGORIES.flatMap(c =>
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
        {OPTIONAL_EXTRA_CATEGORIES.map(cat => (
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
            <span className="extras-grand-total">Configured total: <strong>{formatPrice(basePriceNum + extrasTotal)}</strong></span>
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
