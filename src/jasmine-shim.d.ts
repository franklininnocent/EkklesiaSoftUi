declare namespace jasmine {
  type SpyObj<T> = jest.Mocked<T>;
  function createSpy(name?: string): unknown;
}


