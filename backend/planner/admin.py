from django.contrib import admin
from .models import CalendarConnection, Challenge, ChallengeParticipation, CommunityPost, Feedback, PlanOverride, Profile, Schedule, SleepSession

admin.site.register([Profile, Schedule, CalendarConnection, Feedback, PlanOverride, SleepSession, Challenge, ChallengeParticipation, CommunityPost])
