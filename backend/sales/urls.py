from django.urls import path
from . import views

urlpatterns = [
    path('sales/', views.sales_list_create, name='sales-list-create'),
    path('auth/csrf/', views.csrf_token_view, name='auth-csrf'),
    path('auth/status/', views.auth_status_view, name='auth-status'),
    path('auth/login/', views.login_view, name='auth-login'),
    path('auth/logout/', views.logout_view, name='auth-logout'),
]
