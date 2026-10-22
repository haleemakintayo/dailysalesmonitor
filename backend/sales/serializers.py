import re
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from rest_framework import serializers
from .models import Sale

LAGOS_TZ = ZoneInfo("Africa/Lagos")

class SaleSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)

    class Meta:
        model = Sale
        fields = ['id', 'item_name', 'amount', 'sold_at']
        read_only_fields = ['id']

    def validate_item_name(self, value):
        trimmed = value.strip() if value else ""
        if not trimmed:
            raise serializers.ValidationError("Item name cannot be blank.")
        if len(trimmed) > 120:
            raise serializers.ValidationError("Ensure this field has no more than 120 characters.")
        return trimmed

    def validate_amount(self, value):
        if value is None:
            raise serializers.ValidationError("Amount is required.")
        if value <= Decimal('0.00'):
            raise serializers.ValidationError("Amount must be positive and greater than zero.")
        if value > Decimal('9999999999.99'):
            raise serializers.ValidationError("Amount cannot exceed ₦9,999,999,999.99.")
        
        # Check decimal places
        exponent = abs(value.as_tuple().exponent)
        if exponent > 2:
            raise serializers.ValidationError("Amount cannot have more than two decimal places.")
        return value

    def validate_sold_at(self, value):
        # Check raw input string for explicit timezone offset if available in initial_data
        raw_val = self.initial_data.get('sold_at') if hasattr(self, 'initial_data') else None
        if isinstance(raw_val, str):
            # Check for offset like +01:00, -0500, or Z
            has_offset = re.search(r'(Z|[+-]\d{2}:?\d{2})$', raw_val.strip())
            if not has_offset:
                raise serializers.ValidationError(
                    "Timezone-aware timestamp with explicit offset required (e.g. 2026-10-17T09:15:00+01:00)."
                )

        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            raise serializers.ValidationError("Timezone-aware timestamp with explicit offset required.")

        # Convert to Africa/Lagos
        sold_at_lagos = value.astimezone(LAGOS_TZ)
        now_lagos = datetime.now(LAGOS_TZ)

        # Compare at minute precision for future-time validation
        sold_at_minute = sold_at_lagos.replace(second=0, microsecond=0)
        now_minute = now_lagos.replace(second=0, microsecond=0)

        if sold_at_minute > now_minute:
            raise serializers.ValidationError("Sale time cannot be in the future.")

        return value

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Ensure amount is string with 2 decimal places
        ret['amount'] = f"{instance.amount:.2f}"
        # Ensure sold_at has explicit Lagos offset format
        sold_at_lagos = instance.sold_at.astimezone(LAGOS_TZ)
        ret['sold_at'] = sold_at_lagos.isoformat(timespec='seconds')
        return ret
