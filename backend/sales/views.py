from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.db import models
from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Sale
from .serializers import SaleSerializer

LAGOS_TZ = ZoneInfo("Africa/Lagos")


def check_restricted_access(request):
    """Check if restricted mode is enabled and user is unauthenticated."""
    if getattr(settings, 'RESTRICTED_ACCESS', False):
        return request.user.is_authenticated
    return True


@api_view(['GET', 'POST'])
def sales_list_create(request):
    """
    GET: Return sales for a specific date (defaults to today in Africa/Lagos)
    along with server-authoritative decimal sum and count.
    POST: Record a new sale with validation.
    """
    if not check_restricted_access(request):
        return Response(
            {"detail": "Authentication credentials were not provided."},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'GET':
        date_param = request.query_params.get('date')
        if date_param:
            try:
                target_date = datetime.strptime(date_param, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            target_date = datetime.now(LAGOS_TZ).date()

        # Lagos date boundaries
        start_instant = datetime.combine(target_date, time.min, tzinfo=LAGOS_TZ)
        end_instant = start_instant + timedelta(days=1)

        # Database is authoritative: query filtered records
        queryset = Sale.objects.filter(
            sold_at__gte=start_instant,
            sold_at__lt=end_instant
        ).order_by('-sold_at', '-id')

        # Compute total using decimal database aggregate
        aggregate_result = queryset.aggregate(
            total=Coalesce(
                Sum('amount'),
                Value(Decimal('0.00'), output_field=models.DecimalField(max_digits=12, decimal_places=2))
            )
        )
        total_decimal = aggregate_result['total'] or Decimal('0.00')

        serializer = SaleSerializer(queryset, many=True)

        return Response({
            "date": target_date.strftime("%Y-%m-%d"),
            "timezone": "Africa/Lagos",
            "currency": "NGN",
            "total": f"{total_decimal:.2f}",
            "count": queryset.count(),
            "sales": serializer.data
        })

    elif request.method == 'POST':
        serializer = SaleSerializer(data=request.data)
        if serializer.is_valid():
            sale = serializer.save()
            return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([AllowAny])
def csrf_token_view(request):
    """Ensure CSRF cookie is set and return CSRF token in response."""
    token = get_token(request)
    return Response({"csrfToken": token})


@api_view(['GET'])
@permission_classes([AllowAny])
def auth_status_view(request):
    """Return current session authentication status and restricted mode setting."""
    is_auth = request.user.is_authenticated
    return Response({
        "authenticated": is_auth,
        "username": request.user.username if is_auth else None,
        "restricted_mode": getattr(settings, 'RESTRICTED_ACCESS', False)
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Log in user using standard Django session authentication."""
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return Response({
            "success": True,
            "username": user.username,
            "authenticated": True
        })
    return Response(
        {"error": "Invalid username or password."},
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['POST'])
def logout_view(request):
    """Log out user from the current session."""
    logout(request)
    return Response({"success": True, "authenticated": False})
