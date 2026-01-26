import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Breadcrumb from '@/components/Breadcrumb';

describe('Breadcrumb', () => {
  describe('size prop', () => {
    it('defaults to text-sm when no size prop is provided', () => {
      render(
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Current' }]} />
      );
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('text-sm');
    });

    it('applies text-sm class when size is "sm"', () => {
      render(
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'Current' }]}
          size="sm"
        />
      );
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('text-sm');
    });

    it('applies text-base class when size is "base"', () => {
      render(
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'Current' }]}
          size="base"
        />
      );
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('text-base');
    });

    it('applies text-lg class when size is "lg"', () => {
      render(
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'Current' }]}
          size="lg"
        />
      );
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('text-lg');
    });
  });

  describe('rendering', () => {
    it('renders all breadcrumb items', () => {
      render(
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/admin' },
            { label: 'Events', href: '/admin/events' },
            { label: 'Office Hours' },
          ]}
        />
      );
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Events')).toBeInTheDocument();
      expect(screen.getByText('Office Hours')).toBeInTheDocument();
    });

    it('renders links for items with href', () => {
      render(
        <Breadcrumb
          items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Current' }]}
        />
      );
      const link = screen.getByRole('link', { name: 'Dashboard' });
      expect(link).toHaveAttribute('href', '/admin');
    });

    it('renders separators between items', () => {
      render(
        <Breadcrumb
          items={[{ label: 'First' }, { label: 'Second' }, { label: 'Third' }]}
        />
      );
      // Two separators for three items
      const separators = screen.getAllByText('/');
      expect(separators).toHaveLength(2);
    });

    it('does not render separator before first item', () => {
      const { container } = render(
        <Breadcrumb items={[{ label: 'Only Item' }]} />
      );
      expect(container.textContent).not.toMatch(/^\/Only Item/);
    });
  });
});
