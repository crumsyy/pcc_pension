'use client';

import { Tabs as AriaTabs, TabList as AriaTabList, Tab as AriaTab, TabPanel as AriaTabPanel } from 'react-aria-components';

/**
 * Tabs set (shadcn-style API over React Aria).
 *
 * <Tabs selectedKey={tab} onSelectionChange={setTab}>
 *   <TabList aria-label="...">
 *     <Tab id="billing">Billing</Tab>
 *     <Tab id="payments">Payments</Tab>
 *   </TabList>
 *   <TabPanel id="billing">...</TabPanel>
 *   <TabPanel id="payments">...</TabPanel>
 * </Tabs>
 */
export function Tabs({ children, className = '', ...props }) {
  return (
    <AriaTabs
      {...props}
      className={['pcc-tabs', className].filter(Boolean).join(' ')}
    >
      {children}
    </AriaTabs>
  );
}

export function TabList({ children, className = '', ...props }) {
  return (
    <AriaTabList
      {...props}
      className={['pcc-tab-list', className].filter(Boolean).join(' ')}
    >
      {children}
    </AriaTabList>
  );
}

export function Tab({ children, className = '', ...props }) {
  return (
    <AriaTab
      {...props}
      className={['pcc-tab', className].filter(Boolean).join(' ')}
    >
      {children}
    </AriaTab>
  );
}

export function TabPanel({ children, className = '', ...props }) {
  return (
    <AriaTabPanel
      {...props}
      className={['pcc-tab-panel', className].filter(Boolean).join(' ')}
    >
      {children}
    </AriaTabPanel>
  );
}
