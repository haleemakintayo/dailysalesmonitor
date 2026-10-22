from django.contrib import admin
from .models import Sale

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ('id', 'item_name', 'amount', 'sold_at', 'created_at')
    list_filter = ('sold_at', 'created_at')
    search_fields = ('item_name',)
    ordering = ('-sold_at', '-id')
