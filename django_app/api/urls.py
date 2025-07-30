# api/urls.py
from django.urls import path, include
from api.views import CheckAuthenticationApiView, UserCartApiView, UploadCSVApiView, CheckCSVForED50ApiView, CalculateED50ApiView
from api.views import BioSamplesApiView, ObservationsApiView, \
    ColoniesApiView, ThermalToleranceApiView, ThermalToleranceMinMaxView, \
    BreakpointTemperatureApiView, BreakpointTemperatureMinMaxView, \
    ThermalLimitApiView, ThermalLimitMinMaxView, \
    ProjectsApiView

urlpatterns = [
    path('auth/', include([
        path('', include('rest_framework.urls')),
        path('cart/', UserCartApiView.as_view()),
        path('status/', CheckAuthenticationApiView.as_view()),
        path('upload-csv/', UploadCSVApiView.as_view()),
        path('check-csv-ed50/', CheckCSVForED50ApiView.as_view()),
        path('calculate-ed50/', CalculateED50ApiView.as_view()),
    ])),
    path('public/', include([
        path('biosamples/', BioSamplesApiView.as_view()),
        path('colonies/', ColoniesApiView.as_view()),
        path('observations/', ObservationsApiView.as_view()),
        path('projects/', ProjectsApiView.as_view()),
        path('thermal-tolerances/', include([
            path('', ThermalToleranceApiView.as_view()),
            # Main API view for thermal tolerances
            path('max-min/', ThermalToleranceMinMaxView.as_view()),
            # Nested URL for max-min values
        ])),
        path('breakpoint-temperatures/', include([
            path('', BreakpointTemperatureApiView.as_view()),
            # Main API view for breakpoint temperatures
            path('max-min/', BreakpointTemperatureMinMaxView.as_view()),
            # Nested URL for max-min values
        ])),
        path('thermal-limits/', include([
            path('', ThermalLimitApiView.as_view()),
            # Main API view for thermal limits
            path('max-min/', ThermalLimitMinMaxView.as_view()),
            # Nested URL for max-min values
        ])),
    ]))
]
