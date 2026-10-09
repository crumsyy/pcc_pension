'use client';

import React from 'react';

/**
 * HeaderWidgetBoundary — isolates header widgets (search palette, user menu)
 * so a render error in them can never take down the whole portal layout.
 * Falls back to rendering nothing (the widget simply stays hidden).
 */
export class HeaderWidgetBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    try {
      console.error('Header widget error (contained):', error);
    } catch (e) {}
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export default HeaderWidgetBoundary;
