export function buildNavigation(request) {
  const navigation = [
    {
      text: 'Home',
      href: '/',
      current: request?.path === '/'
    },
    {
      text: 'About',
      href: '/about',
      current: request?.path === '/about'
    }
  ]

  if (request?.auth?.isAuthenticated) {
    navigation.push({
      text: 'Example',
      href: '/example',
      current: request?.path === '/example'
    })
  }

  return navigation
}
