from rest_framework import serializers

from profiles.models import ResearcherProfile


MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024


def get_profile_photo_url(profile, request=None):
    if not profile or not profile.profile_photo:
        return None
    if request:
        return request.build_absolute_uri(profile.profile_photo.url)
    return profile.profile_photo.url


class ResearcherProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', max_length=30)
    last_name = serializers.CharField(source='user.last_name', max_length=30)
    profile_photo_url = serializers.SerializerMethodField()
    research_interests = serializers.ListField(child=serializers.CharField(), required=False)
    expertise = serializers.ListField(child=serializers.CharField(), required=False)
    links = serializers.ListField(child=serializers.DictField(), required=False)

    class Meta:
        model = ResearcherProfile
        fields = [
            'username', 'email', 'first_name', 'last_name', 'profile_photo',
            'profile_photo_url', 'description', 'affiliation', 'department',
            'position', 'city', 'country', 'orcid', 'website', 'google_scholar',
            'researchgate', 'research_interests', 'expertise', 'links',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['username', 'email', 'profile_photo_url', 'created_at', 'updated_at']
        extra_kwargs = {
            'profile_photo': {'required': False, 'allow_null': True},
        }

    def get_profile_photo_url(self, obj):
        return get_profile_photo_url(obj, self.context.get('request'))

    def validate_profile_photo(self, value):
        if value and value.size > MAX_PROFILE_PHOTO_SIZE:
            raise serializers.ValidationError('Profile photo must be smaller than 5 MB.')
        if value and value.content_type not in ('image/jpeg', 'image/png', 'image/webp'):
            raise serializers.ValidationError('Profile photo must be a JPG, PNG, or WebP image.')
        return value

    def validate_links(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Links must be a list.')
        for link in value:
            if not isinstance(link, dict) or not link.get('url'):
                raise serializers.ValidationError('Each link must include a URL.')
        return value

    def validate_research_interests(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Research interests must be a list.')
        return value

    def validate_expertise(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Expertise must be a list.')
        return value

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        if user_data:
            user = instance.user
            for attr, value in user_data.items():
                setattr(user, attr, value)
            user.save(update_fields=list(user_data.keys()))
        return super().update(instance, validated_data)


class PublicResearcherProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    profile_photo_url = serializers.SerializerMethodField()
    projects = serializers.SerializerMethodField()

    class Meta:
        model = ResearcherProfile
        fields = [
            'username', 'first_name', 'last_name', 'profile_photo_url',
            'description', 'affiliation', 'department', 'position', 'city',
            'country', 'orcid', 'website', 'google_scholar', 'researchgate',
            'research_interests', 'expertise', 'links', 'projects'
        ]

    def get_profile_photo_url(self, obj):
        return get_profile_photo_url(obj, self.context.get('request'))

    def get_projects(self, obj):
        request = self.context.get('request')
        projects = obj.user.projects.prefetch_related('publications', 'attachments').order_by('-registration_date', '-id')
        data = []
        for project in projects:
            attachment = project.attachments.first()
            cover_photo = None
            if attachment and attachment.cover_photo:
                cover_photo = request.build_absolute_uri(attachment.cover_photo.url) if request else attachment.cover_photo.url
            data.append({
                'id': project.id,
                'name': project.name,
                'registration_date': project.registration_date,
                'description': project.description,
                'cover_photo': cover_photo,
                'publications_count': project.publications.count(),
            })
        return data
