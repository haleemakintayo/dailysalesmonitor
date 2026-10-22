from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class Sale(models.Model):
    item_name = models.CharField(
        max_length=120,
        help_text="Name or description of the sold item (1-120 characters)."
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal('0.01'), message="Amount must be positive and greater than zero."),
            MaxValueValidator(Decimal('9999999999.99'), message="Amount cannot exceed ₦9,999,999,999.99.")
        ],
        help_text="Sale amount in Nigerian Naira (NGN)."
    )
    sold_at = models.DateTimeField(
        db_index=True,
        help_text="Timezone-aware timestamp when the sale occurred."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Server timestamp when the record was created."
    )

    class Meta:
        ordering = ['-sold_at', '-id']
        verbose_name = "Sale"
        verbose_name_plural = "Sales"

    def clean(self):
        super().clean()
        if self.item_name:
            self.item_name = self.item_name.strip()

    def save(self, *args, **kwargs):
        if self.item_name:
            self.item_name = self.item_name.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item_name} - ₦{self.amount} ({self.sold_at})"
