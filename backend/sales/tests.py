from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from .models import Sale

LAGOS_TZ = ZoneInfo("Africa/Lagos")


class SaleModelAndApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('sales-list-create')

    def test_save_valid_sale_ac1(self):
        """AC1: Save a valid sale returns HTTP 201 and persists record."""
        now_lagos = datetime.now(LAGOS_TZ).replace(second=0, microsecond=0)
        payload = {
            "item_name": "  Bread  ",
            "amount": "1250.00",
            "sold_at": now_lagos.isoformat()
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['item_name'], "Bread")  # trimmed
        self.assertEqual(response.data['amount'], "1250.00")
        self.assertTrue(Sale.objects.filter(item_name="Bread").exists())

    def test_blank_or_whitespace_item_name_rejected_ac2(self):
        """AC2: Blank or whitespace-only item name returns HTTP 400."""
        now_lagos = datetime.now(LAGOS_TZ).isoformat()
        for blank_name in ["", "   ", "\t\n"]:
            response = self.client.post(self.url, {
                "item_name": blank_name,
                "amount": "500.00",
                "sold_at": now_lagos
            }, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("item_name", response.data)
        self.assertEqual(Sale.objects.count(), 0)

    def test_zero_or_negative_amount_rejected_ac2(self):
        """AC2: Zero or negative amount returns HTTP 400."""
        now_lagos = datetime.now(LAGOS_TZ).isoformat()
        for bad_amount in ["0.00", "0", "-150.00", "-0.01"]:
            response = self.client.post(self.url, {
                "item_name": "Milk",
                "amount": bad_amount,
                "sold_at": now_lagos
            }, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("amount", response.data)
        self.assertEqual(Sale.objects.count(), 0)

    def test_too_many_decimal_places_rejected_ac3(self):
        """AC3: Submit too many decimal places returns HTTP 400."""
        now_lagos = datetime.now(LAGOS_TZ).isoformat()
        response = self.client.post(self.url, {
            "item_name": "Juice",
            "amount": "150.125",
            "sold_at": now_lagos
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("amount", response.data)

    def test_future_datetime_rejected_ac3(self):
        """AC3: Datetime in future minute returns HTTP 400."""
        future_time = datetime.now(LAGOS_TZ) + timedelta(minutes=5)
        response = self.client.post(self.url, {
            "item_name": "Cake",
            "amount": "2000.00",
            "sold_at": future_time.isoformat()
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("sold_at", response.data)

    def test_naive_datetime_rejected_ac3(self):
        """AC3: Datetime without timezone offset is rejected."""
        response = self.client.post(self.url, {
            "item_name": "Cake",
            "amount": "2000.00",
            "sold_at": "2026-10-17T09:15:00"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("sold_at", response.data)

    def test_decimal_aggregation_accuracy_ac4(self):
        """AC4: Save ₦100.10 and ₦200.20 on an otherwise empty day -> Total is exactly ₦300.30."""
        test_date = datetime(2026, 10, 17, 10, 0, 0, tzinfo=LAGOS_TZ)
        Sale.objects.create(item_name="Item 1", amount=Decimal("100.10"), sold_at=test_date)
        Sale.objects.create(item_name="Item 2", amount=Decimal("200.20"), sold_at=test_date + timedelta(minutes=10))

        response = self.client.get(f"{self.url}?date=2026-10-17")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], "300.30")
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['sales']), 2)

    def test_lagos_date_boundaries_ac5(self):
        """
        AC5: Records at 23:59 yesterday and 00:00 today, Lagos time.
        Only today's record contributes to today's total.
        """
        target_date = datetime(2026, 10, 17, 0, 0, 0, tzinfo=LAGOS_TZ)
        yesterday_late = target_date - timedelta(seconds=1)  # 2026-10-16 23:59:59 in Lagos
        today_midnight = target_date                        # 2026-10-17 00:00:00 in Lagos

        Sale.objects.create(item_name="Yesterday Sale", amount=Decimal("500.00"), sold_at=yesterday_late)
        Sale.objects.create(item_name="Today Midnight Sale", amount=Decimal("750.00"), sold_at=today_midnight)

        response = self.client.get(f"{self.url}?date=2026-10-17")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], "750.00")
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['sales'][0]['item_name'], "Today Midnight Sale")

    def test_empty_day_ac8(self):
        """AC8: Open an empty day returns ₦0.00 total and count 0."""
        response = self.client.get(f"{self.url}?date=2026-01-01")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], "0.00")
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['sales'], [])

    def test_invalid_date_query_param(self):
        """Invalid date query param returns HTTP 400."""
        response = self.client.get(f"{self.url}?date=invalid-date")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
