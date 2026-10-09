'use client';

import { useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs';
import BillingTabContent from './BillingTab';
import PaymentsTabContent from './PaymentsTab';

function readTab(searchParams) {
  return searchParams.get('tab') === 'payments' ? 'payments' : 'billing';
}

export default function BillingCheckoutClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState(() => readTab(searchParams));

  const handleTabChange = (key) => {
    const nextTab = key === 'payments' ? 'payments' : 'billing';
    setTab(nextTab);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', nextTab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch (e) {}
  };

  return (
    <div>
      <div className="mb-4">
        <div className="section-eyebrow">Receptionist</div>
        <h2 className="section-title mb-0">Billing &amp; Checkout</h2>
      </div>

      <Tabs selectedKey={tab} onSelectionChange={handleTabChange}>
        <TabList aria-label="Billing and checkout">
          <Tab id="billing">Billing</Tab>
          <Tab id="payments">Payments</Tab>
        </TabList>
        <TabPanel id="billing">
          <BillingTabContent />
        </TabPanel>
        <TabPanel id="payments">
          <PaymentsTabContent />
        </TabPanel>
      </Tabs>
    </div>
  );
}
