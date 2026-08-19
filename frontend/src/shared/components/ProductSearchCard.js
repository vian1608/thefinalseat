import React from 'react';
import './ProductSearchCard.css';

function ProductSearchCard({
  theme = 'flights',
  eyebrow,
  title,
  trustIcon = 'fas fa-shield-alt',
  trustText,
  children,
  className = ''
}) {
  return (
    <div className={`product-search-card product-search-card--${theme} ${className}`.trim()}>
      {(eyebrow || title || trustText) && (
        <div className="product-search-card__heading">
          <div className="product-search-card__heading-copy">
            {eyebrow && <span className="product-search-card__eyebrow">{eyebrow}</span>}
            {title && <h2>{title}</h2>}
          </div>
          {trustText && (
            <div className="product-search-card__trust-note">
              <i className={trustIcon} aria-hidden="true" />
              <span>{trustText}</span>
            </div>
          )}
        </div>
      )}
      <div className="product-search-card__body">{children}</div>
    </div>
  );
}

export default ProductSearchCard;
