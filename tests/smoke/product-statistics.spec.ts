import { type Page, expect, test } from '@playwright/test'

const pageOneOrders = [
  {
    id: 101,
    is_paid: true,
    status: 'PAID',
    order_type: 'HALL',
    created_at: '2026-07-20T08:00:00Z',
    items: [
      {
        id: 1001,
        product__id: 'burger',
        product__name: 'Burger',
        product__category__id: 'mains',
        product__category__name: 'Mains',
        quantity: '2',
        price: '30000',
      },
    ],
  },
  {
    id: 102,
    is_paid: true,
    status: 'CANCELED',
    order_type: 'HALL',
    created_at: '2026-07-20T09:00:00Z',
    items: [
      {
        id: 1002,
        product__id: 'canceled-pizza',
        product__name: 'Canceled Pizza',
        product__category__id: 'mains',
        product__category__name: 'Mains',
        quantity: '99',
        price: '100000',
      },
    ],
  },
]

const pageTwoOrders = [
  {
    id: 103,
    is_paid: true,
    status: 'PAID',
    order_type: 'PICKUP',
    created_at: '2026-07-21T08:00:00Z',
    items: [
      {
        id: 1003,
        product__id: 'pasta',
        product__name: 'Pasta',
        product__category__id: 'mains',
        product__category__name: 'Mains',
        quantity: '3',
        price: '15000',
      },
    ],
  },
]

async function mockProductStatisticsApi(page: Page): Promise<number[]> {
  const requestedPages: number[] = []

  await page.route('**/api/admins/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path.endsWith('/orders') && request.method() === 'GET') {
      const requestedPage = Number(url.searchParams.get('page') ?? '1')

      requestedPages.push(requestedPage)
      await route.fulfill({
        json: {
          data: {
            orders: requestedPage === 1 ? pageOneOrders : pageTwoOrders,
            pagination: {
              total_pages: 2,
              total_orders: 3,
            },
          },
        },
      })
      return
    }

    if (path.endsWith('/products') && request.method() === 'GET') {
      await route.fulfill({
        json: {
          data: {
            products: [
              { id: 'burger', name: 'Burger', category_id: 'mains' },
              { id: 'pasta', name: 'Pasta', category_id: 'mains' },
              { id: 'no-sales-salad', name: 'No-sales salad', category_id: 'drinks' },
            ],
            pagination: { total_pages: 1 },
          },
        },
      })
      return
    }

    if (path.endsWith('/categories') && request.method() === 'GET') {
      await route.fulfill({
        json: {
          data: {
            categories: [
              { id: 'mains', name: 'Mains' },
              { id: 'drinks', name: 'Drinks' },
            ],
            pagination: { total_pages: 1 },
          },
        },
      })
      return
    }

    if (path.endsWith('/auth-me') || path.endsWith('/app-settings')) {
      await route.fulfill({ json: { data: {} } })
      return
    }

    // Keep the route isolated from app-shell requests such as navigation counts.
    await route.fulfill({ json: { data: {} } })
  })

  return requestedPages
}

test.describe('product sales analytics', () => {
  test('loads every orders page, excludes canceled sales, and filters products and categories locally', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('appLocale', 'en')
      localStorage.setItem('numberFormat', 'full')
      localStorage.setItem('accessToken', JSON.stringify('test-token'))
      localStorage.setItem('userData', JSON.stringify({ id: 1, name: 'Manager' }))
      localStorage.setItem('userAbilities', JSON.stringify([{ action: 'manage', subject: 'all' }]))
    })

    const requestedPages = await mockProductStatisticsApi(page)

    await page.goto('/analytics/product-statistics')

    const table = page.getByTestId('product-statistics-table')

    await expect(table).toContainText('Burger')
    await expect(table).toContainText('Pasta')
    await expect(table).not.toContainText('Canceled Pizza')
    expect(requestedPages).toEqual([1, 2])

    await expect(page.locator('.kpi').filter({ hasText: 'Gross item sales' })).toContainText(/105.*000.*UZS/)
    await expect(page.locator('.kpi').filter({ hasText: 'Units sold' })).toContainText('5')
    await expect(page.getByText(/Gross item sales use historical item price/)).toBeVisible()

    await page.getByTestId('product-statistics-product-filter').click()
    await expect(page.getByTestId('product-statistics-product-option-no-sales-salad')).toBeVisible()
    await page.getByTestId('product-statistics-product-option-burger').click()

    await expect(table).toContainText('Burger')
    await expect(table).not.toContainText('Pasta')

    await page.getByTestId('product-statistics-product-filter').click()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await page.getByTestId('product-statistics-category-filter').click()
    await page.getByTestId('product-statistics-category-option-drinks').click()
    await expect(page.getByText('No paid product sales found')).toBeVisible()
  })
})
