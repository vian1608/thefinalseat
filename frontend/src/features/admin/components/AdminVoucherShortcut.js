import React from 'react';
import { Link } from 'react-router-dom';
import './AdminVoucherShortcut.css';

export default function AdminVoucherShortcut() {
  return (
    <Link
      to="/admin/vouchers"
      className="admin-voucher-shortcut"
      aria-label="Open voucher and coupon management"
      title="Manage vouchers and coupons"
    >
      <i className="fas fa-ticket-alt" aria-hidden="true" />
      <span>
        <strong>Vouchers</strong>
        <small>Create coupons</small>
      </span>
    </Link>
  );
}
