from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Profile


@receiver(post_save, sender=get_user_model())
def create_sleep_profile_for_user(sender, instance, created, **kwargs):
    if created:
        Profile.objects.get_or_create(
            user=instance,
            defaults={
                "external_id": f"user-{instance.pk}",
                "name": instance.get_full_name().strip() or instance.email or "사용자",
            },
        )